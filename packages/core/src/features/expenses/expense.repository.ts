import { and, count, desc, eq, gte, ilike, or, sql, type SQL } from 'drizzle-orm';
import {
  auditLogs,
  expenseCategories,
  expenseCounters,
  expenses,
  newId,
  organizations,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { RecordExpenseInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

function searchFilter(search: string | null): SQL | undefined {
  if (!search) return undefined;
  const term = `%${search}%`;
  return or(ilike(expenses.paidTo, term), ilike(expenses.voucherNumber, term));
}

/**
 * Resolve (or create) an expense category by case-insensitive name. Exported so
 * the payables ledger can tag vendor-payment vouchers with the vendor's category
 * without duplicating the find-or-create logic.
 */
export async function findOrCreateExpenseCategory(
  tx: Tx,
  organizationId: string,
  name: string,
): Promise<string> {
  const [existing] = await tx
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(
      and(
        eq(expenseCategories.organizationId, organizationId),
        sql`lower(${expenseCategories.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const [created] = await tx
    .insert(expenseCategories)
    .values({ id: newId(), organizationId, name })
    .returning({ id: expenseCategories.id });
  if (!created) throw new Error('expense category insert returned no row');
  return created.id;
}

/**
 * Own sequence, distinct from donation receipts — vouchers read EV2026-00001.
 * Exported so vendor-bill payments draw from the same voucher book.
 */
export async function allocateVoucherNumber(tx: Tx, organizationId: string, year: number) {
  const [counter] = await tx
    .insert(expenseCounters)
    .values({ organizationId, nextNumber: 2 })
    .onConflictDoUpdate({
      target: expenseCounters.organizationId,
      set: { nextNumber: sql`${expenseCounters.nextNumber} + 1` },
    })
    .returning({ nextNumber: expenseCounters.nextNumber });
  if (!counter) throw new Error('voucher counter returned no row');
  const seq = counter.nextNumber - 1;
  return `EV${year}-${String(seq).padStart(5, '0')}`;
}

export function createExpenseRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const baseSelect = (tx: Tx) =>
    tx
      .select({
        id: expenses.id,
        voucherNumber: expenses.voucherNumber,
        paidTo: expenses.paidTo,
        categoryName: expenseCategories.name,
        amount: expenses.amount,
        currency: expenses.currency,
        method: expenses.method,
        reference: expenses.reference,
        note: expenses.note,
        spentAt: expenses.spentAt,
        status: expenses.status,
        voidReason: expenses.voidReason,
        approvalStatus: expenses.approvalStatus,
        rejectionReason: expenses.rejectionReason,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id));

  return {
    async record(ctx: TenantContext, input: RecordExpenseInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({
            currency: organizations.currency,
            approvalThreshold: organizations.expenseApprovalThreshold,
          })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const categoryId = input.categoryName
          ? await findOrCreateExpenseCategory(tx, ctx.organizationId, input.categoryName)
          : null;

        const spentAt = input.spentOn ? new Date(`${input.spentOn}T12:00:00`) : new Date();
        const voucherNumber = await allocateVoucherNumber(
          tx,
          ctx.organizationId,
          spentAt.getFullYear(),
        );

        // Above the org's threshold (if any) → needs sign-off before it's approved.
        const needsApproval =
          org.approvalThreshold != null && input.amount >= Number(org.approvalThreshold);
        const approvalStatus = needsApproval ? 'pending' : 'not_required';

        const [expense] = await tx
          .insert(expenses)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            categoryId,
            fundId: input.fundId ?? null,
            accountId: input.accountId ?? null,
            employeeId: input.employeeId ?? null,
            paidTo: input.paidTo,
            amount: input.amount.toFixed(2),
            currency: org.currency,
            method: input.method,
            reference: input.reference ?? null,
            note: input.note ?? null,
            voucherNumber,
            spentAt,
            recordedByUserId: ctx.userId,
            approvalStatus,
          })
          .returning();
        if (!expense) throw new Error('expense insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'expense.recorded',
          entityType: 'expense',
          entityId: expense.id,
          after: {
            voucherNumber,
            paidTo: expense.paidTo,
            amount: expense.amount,
            method: expense.method,
            approvalStatus,
          },
        });

        return expense;
      });
    },

    async list(
      ctx: TenantContext,
      query: { search: string | null; page: number; pageSize: number },
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const where = and(
          eq(expenses.organizationId, ctx.organizationId),
          searchFilter(query.search),
        );
        const [items, [totalRow]] = await Promise.all([
          baseSelect(tx)
            .where(where)
            .orderBy(desc(expenses.spentAt))
            .limit(query.pageSize)
            .offset((query.page - 1) * query.pageSize),
          tx.select({ value: count() }).from(expenses).where(where),
        ]);
        return { items, total: totalRow?.value ?? 0 };
      });
    },

    async findById(ctx: TenantContext, expenseId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx).where(eq(expenses.id, expenseId)).limit(1);
        return row ?? null;
      });
    },

    async void(ctx: TenantContext, expenseId: string, reason: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [current] = await tx
          .select({ status: expenses.status, voucherNumber: expenses.voucherNumber })
          .from(expenses)
          .where(eq(expenses.id, expenseId))
          .limit(1);
        if (!current) return { kind: 'not_found' as const };
        if (current.status === 'void') return { kind: 'already_void' as const };

        await tx
          .update(expenses)
          .set({ status: 'void', voidReason: reason })
          .where(eq(expenses.id, expenseId));

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'expense.voided',
          entityType: 'expense',
          entityId: expenseId,
          after: { voucherNumber: current.voucherNumber, reason },
        });
        return { kind: 'ok' as const };
      });
    },

    async stats(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const recorded = and(
          eq(expenses.organizationId, ctx.organizationId),
          eq(expenses.status, 'recorded'),
        );
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [[allTime], [month]] = await Promise.all([
          tx
            .select({ total: sql<string>`coalesce(sum(${expenses.amount}), '0.00')` })
            .from(expenses)
            .where(recorded),
          tx
            .select({
              total: sql<string>`coalesce(sum(${expenses.amount}), '0.00')`,
              count: count(),
            })
            .from(expenses)
            .where(and(recorded, gte(expenses.spentAt, monthStart))),
        ]);

        return {
          currency: org.currency,
          allTimeTotal: allTime?.total ?? '0.00',
          monthTotal: month?.total ?? '0.00',
          monthCount: month?.count ?? 0,
        };
      });
    },

    /** Recorded-only total for a date range — powers the income vs expense net. */
    async rangeSummary(ctx: TenantContext, from: string | null, to: string | null) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const filters: SQL[] = [
          eq(expenses.organizationId, ctx.organizationId),
          eq(expenses.status, 'recorded'),
        ];
        if (from) filters.push(gte(expenses.spentAt, new Date(`${from}T00:00:00`)));
        if (to) filters.push(sql`${expenses.spentAt} < ${new Date(`${to}T00:00:00`)}::timestamptz + interval '1 day'`);
        const [row] = await tx
          .select({
            total: sql<string>`coalesce(sum(${expenses.amount}), '0.00')`,
            count: count(),
          })
          .from(expenses)
          .where(and(...filters));
        return { total: row?.total ?? '0.00', count: row?.count ?? 0 };
      });
    },

    async listPending(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(
            and(
              eq(expenses.organizationId, ctx.organizationId),
              eq(expenses.approvalStatus, 'pending'),
            ),
          )
          .orderBy(desc(expenses.spentAt)),
      );
    },

    async pendingCount(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select({ value: count() })
          .from(expenses)
          .where(
            and(
              eq(expenses.organizationId, ctx.organizationId),
              eq(expenses.approvalStatus, 'pending'),
            ),
          );
        return row?.value ?? 0;
      });
    },

    /** Approve or reject a pending expense; returns the resolved kind. */
    async decide(
      ctx: TenantContext,
      expenseId: string,
      decision: 'approved' | 'rejected',
      reason: string | null,
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [current] = await tx
          .select({ approvalStatus: expenses.approvalStatus, voucherNumber: expenses.voucherNumber })
          .from(expenses)
          .where(eq(expenses.id, expenseId))
          .limit(1);
        if (!current) return { kind: 'not_found' as const };
        if (current.approvalStatus !== 'pending') return { kind: 'not_pending' as const };

        await tx
          .update(expenses)
          .set({
            approvalStatus: decision,
            approvedByUserId: ctx.userId,
            decidedAt: new Date(),
            rejectionReason: decision === 'rejected' ? reason : null,
          })
          .where(eq(expenses.id, expenseId));

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: decision === 'approved' ? 'expense.approved' : 'expense.rejected',
          entityType: 'expense',
          entityId: expenseId,
          after: { voucherNumber: current.voucherNumber, reason },
        });
        return { kind: 'ok' as const };
      });
    },

    async getApprovalThreshold(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ threshold: organizations.expenseApprovalThreshold, currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');
        return { threshold: org.threshold, currency: org.currency };
      });
    },

    async setApprovalThreshold(ctx: TenantContext, threshold: string | null) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        await tx
          .update(organizations)
          .set({ expenseApprovalThreshold: threshold })
          .where(eq(organizations.id, ctx.organizationId));

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'expense.approval_threshold_set',
          entityType: 'organization',
          entityId: ctx.organizationId,
          after: { threshold },
        });
      });
    },

    /** Full rows for CSV export (reports feature). */
    async exportRows(ctx: TenantContext, from: string | null, to: string | null) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const filters: SQL[] = [eq(expenses.organizationId, ctx.organizationId)];
        if (from) filters.push(gte(expenses.spentAt, new Date(`${from}T00:00:00`)));
        if (to) filters.push(sql`${expenses.spentAt} < ${new Date(`${to}T00:00:00`)}::timestamptz + interval '1 day'`);
        return baseSelect(tx)
          .where(and(...filters))
          .orderBy(desc(expenses.spentAt));
      });
    },
  };
}

export type ExpenseRepository = ReturnType<typeof createExpenseRepository>;
