import { and, asc, desc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  expenses,
  newId,
  organizations,
  recurringExpenses,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { RecurringExpenseInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

// Correlated subqueries use raw identifiers (Drizzle table interpolation
// mis-correlates inside a subquery — see the grants/loans repositories).
const paidTotal = sql<string>`coalesce((
  select sum(e.amount) from expenses e
  where e.recurring_expense_id = recurring_expenses.id and e.status = 'recorded'
), 0)::numeric(12, 2)`;

const lastPaidAt = sql<Date | null>`(
  select max(e.spent_at) from expenses e
  where e.recurring_expense_id = recurring_expenses.id and e.status = 'recorded'
)`;

const accountName = sql<string | null>`(
  select a.name from financial_accounts a where a.id = recurring_expenses.account_id
)`;

export function createRecurringExpenseRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const columns = {
    id: recurringExpenses.id,
    payee: recurringExpenses.payee,
    description: recurringExpenses.description,
    category: recurringExpenses.category,
    amount: recurringExpenses.amount,
    frequency: recurringExpenses.frequency,
    accountId: recurringExpenses.accountId,
    accountName,
    startDate: recurringExpenses.startDate,
    endDate: recurringExpenses.endDate,
    status: recurringExpenses.status,
    paidTotal,
    lastPaidAt,
  };

  const baseSelect = (tx: Tx) => tx.select(columns).from(recurringExpenses);

  return {
    async list(ctx: TenantContext, scope: 'active' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where = and(
          eq(recurringExpenses.organizationId, ctx.organizationId),
          scope === 'active' ? eq(recurringExpenses.status, 'active') : undefined,
        );
        return baseSelect(tx)
          .where(where)
          .orderBy(asc(recurringExpenses.status), asc(recurringExpenses.payee));
      });
    },

    async findById(ctx: TenantContext, recurringId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx).where(eq(recurringExpenses.id, recurringId)).limit(1);
        return row ?? null;
      });
    },

    /** Recorded payments made against this standing order, plus org currency. */
    async payments(ctx: TenantContext, recurringId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const rows = await tx
          .select({
            id: expenses.id,
            voucherNumber: expenses.voucherNumber,
            amount: expenses.amount,
            at: expenses.spentAt,
          })
          .from(expenses)
          .where(
            and(eq(expenses.recurringExpenseId, recurringId), eq(expenses.status, 'recorded')),
          )
          .orderBy(desc(expenses.spentAt))
          .limit(200);
        return { currency: org.currency, payments: rows };
      });
    },

    async create(ctx: TenantContext, input: RecurringExpenseInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(recurringExpenses)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            payee: input.payee,
            description: input.description ?? null,
            category: input.category ?? null,
            amount: input.amount.toFixed(2),
            frequency: input.frequency,
            accountId: input.accountId ?? null,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: recurringExpenses.id });
        if (!row) throw new Error('recurring expense insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'recurring_expense.created',
          entityType: 'recurring_expense',
          entityId: row.id,
          after: { payee: input.payee, amount: input.amount.toFixed(2), frequency: input.frequency },
        });
        return row.id;
      });
    },

    async update(ctx: TenantContext, recurringId: string, input: RecurringExpenseInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(recurringExpenses)
          .set({
            payee: input.payee,
            description: input.description ?? null,
            category: input.category ?? null,
            amount: input.amount.toFixed(2),
            frequency: input.frequency,
            accountId: input.accountId ?? null,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            note: input.note ?? null,
          })
          .where(eq(recurringExpenses.id, recurringId))
          .returning({ id: recurringExpenses.id });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'recurring_expense.updated',
          entityType: 'recurring_expense',
          entityId: recurringId,
          after: { payee: input.payee },
        });
        return updated.id;
      });
    },

    async setStatus(ctx: TenantContext, recurringId: string, status: 'active' | 'paused' | 'ended') {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(recurringExpenses)
          .set({ status })
          .where(eq(recurringExpenses.id, recurringId))
          .returning({ id: recurringExpenses.id, payee: recurringExpenses.payee });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: `recurring_expense.${status}`,
          entityType: 'recurring_expense',
          entityId: recurringId,
          after: { payee: updated.payee, status },
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

        const rows = await tx
          .select({ amount: recurringExpenses.amount, frequency: recurringExpenses.frequency })
          .from(recurringExpenses)
          .where(
            and(
              eq(recurringExpenses.organizationId, ctx.organizationId),
              eq(recurringExpenses.status, 'active'),
            ),
          );
        return { currency: org.currency, rows };
      });
    },

    async exportRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(recurringExpenses.organizationId, ctx.organizationId))
          .orderBy(asc(recurringExpenses.payee)),
      );
    },
  };
}

export type RecurringExpenseRepository = ReturnType<typeof createRecurringExpenseRepository>;
