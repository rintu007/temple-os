import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  donations,
  expenses,
  funds,
  newId,
  organizations,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { FundInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

// Correlated subqueries use raw identifiers (Drizzle table interpolation
// mis-correlates inside a subquery — see the vendors/pledges repositories).

const fundIncome = sql<string>`coalesce((
  select sum(d.amount) from donations d
  where d.fund_id = funds.id and d.status = 'recorded'
), 0)::numeric(12, 2)`;

const fundExpense = sql<string>`coalesce((
  select sum(e.amount) from expenses e
  where e.fund_id = funds.id and e.status = 'recorded'
), 0)::numeric(12, 2)`;

export function createFundRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const fundColumns = {
    id: funds.id,
    name: funds.name,
    description: funds.description,
    isActive: funds.isActive,
    income: fundIncome,
    expense: fundExpense,
  };

  const baseSelect = (tx: Tx) => tx.select(fundColumns).from(funds);

  return {
    async list(ctx: TenantContext, scope: 'active' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where = and(
          eq(funds.organizationId, ctx.organizationId),
          scope === 'active' ? eq(funds.isActive, true) : undefined,
        );
        return baseSelect(tx).where(where).orderBy(desc(funds.isActive), asc(funds.name));
      });
    },

    async findById(ctx: TenantContext, fundId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx).where(eq(funds.id, fundId)).limit(1);
        return row ?? null;
      });
    },

    /** Recorded income and expenditure earmarked to a fund — the detail ledger. */
    async ledger(ctx: TenantContext, fundId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [income, expenditure] = await Promise.all([
          tx
            .select({
              id: donations.id,
              receiptNumber: donations.receiptNumber,
              donorName: donations.donorName,
              amount: donations.amount,
              at: donations.donatedAt,
            })
            .from(donations)
            .where(and(eq(donations.fundId, fundId), eq(donations.status, 'recorded')))
            .orderBy(desc(donations.donatedAt))
            .limit(100),
          tx
            .select({
              id: expenses.id,
              voucherNumber: expenses.voucherNumber,
              paidTo: expenses.paidTo,
              amount: expenses.amount,
              at: expenses.spentAt,
            })
            .from(expenses)
            .where(and(eq(expenses.fundId, fundId), eq(expenses.status, 'recorded')))
            .orderBy(desc(expenses.spentAt))
            .limit(100),
        ]);
        return { income, expenditure };
      });
    },

    async create(ctx: TenantContext, input: FundInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(funds)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            name: input.name,
            description: input.description ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: funds.id });
        if (!row) throw new Error('fund insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'fund.created',
          entityType: 'fund',
          entityId: row.id,
          after: { name: input.name },
        });
        return row.id;
      });
    },

    async update(ctx: TenantContext, fundId: string, input: FundInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(funds)
          .set({ name: input.name, description: input.description ?? null })
          .where(eq(funds.id, fundId))
          .returning({ id: funds.id });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'fund.updated',
          entityType: 'fund',
          entityId: fundId,
          after: { name: input.name },
        });
        return updated.id;
      });
    },

    async setActive(ctx: TenantContext, fundId: string, isActive: boolean) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(funds)
          .set({ isActive })
          .where(eq(funds.id, fundId))
          .returning({ id: funds.id, name: funds.name });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: isActive ? 'fund.reactivated' : 'fund.deactivated',
          entityType: 'fund',
          entityId: fundId,
          after: { name: updated.name, isActive },
        });
        return updated.id;
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

        const [row] = await tx
          .select({
            balance: sql<string>`coalesce(sum(${fundIncome} - ${fundExpense}), 0)::numeric(12, 2)`,
            activeCount: count(),
          })
          .from(funds)
          .where(and(eq(funds.organizationId, ctx.organizationId), eq(funds.isActive, true)));
        return {
          currency: org.currency,
          totalBalance: row?.balance ?? '0.00',
          activeCount: row?.activeCount ?? 0,
        };
      });
    },

    async exportRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(funds.organizationId, ctx.organizationId))
          .orderBy(asc(funds.name)),
      );
    },
  };
}

export type FundRepository = ReturnType<typeof createFundRepository>;
