import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import {
  auditLogs,
  budgets,
  donationCategories,
  donations,
  expenseCategories,
  expenses,
  newId,
  organizations,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { BudgetKind, SetBudgetInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

/** FY start year → [from, to) timestamps, April–March. */
function fyBounds(fy: number): { from: Date; to: Date } {
  return { from: new Date(fy, 3, 1), to: new Date(fy + 1, 3, 1) };
}

export function createBudgetRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    /** Budget lines plus live actuals, grouped by category, for one FY. */
    async comparison(ctx: TenantContext, fy: number) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const { from, to } = fyBounds(fy);

        const [lines, incomeActuals, expenseActuals] = await Promise.all([
          tx
            .select({
              id: budgets.id,
              kind: budgets.kind,
              category: budgets.category,
              amount: budgets.amount,
            })
            .from(budgets)
            .where(and(eq(budgets.organizationId, ctx.organizationId), eq(budgets.financialYear, fy))),
          tx
            .select({
              category: sql<string>`coalesce(${donationCategories.name}, 'Uncategorized')`,
              total: sql<string>`coalesce(sum(${donations.amount}), '0')::numeric(12, 2)`,
            })
            .from(donations)
            .leftJoin(donationCategories, eq(donations.categoryId, donationCategories.id))
            .where(
              and(
                eq(donations.organizationId, ctx.organizationId),
                eq(donations.status, 'recorded'),
                gte(donations.donatedAt, from),
                lt(donations.donatedAt, to),
              ),
            )
            .groupBy(sql`coalesce(${donationCategories.name}, 'Uncategorized')`),
          tx
            .select({
              category: sql<string>`coalesce(${expenseCategories.name}, 'Uncategorized')`,
              total: sql<string>`coalesce(sum(${expenses.amount}), '0')::numeric(12, 2)`,
            })
            .from(expenses)
            .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
            .where(
              and(
                eq(expenses.organizationId, ctx.organizationId),
                eq(expenses.status, 'recorded'),
                gte(expenses.spentAt, from),
                lt(expenses.spentAt, to),
              ),
            )
            .groupBy(sql`coalesce(${expenseCategories.name}, 'Uncategorized')`),
        ]);

        return { currency: org.currency, lines, incomeActuals, expenseActuals };
      });
    },

    /** Distinct financial years that already have budget lines, newest first. */
    async years(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const rows = await tx
          .selectDistinct({ fy: budgets.financialYear })
          .from(budgets)
          .where(eq(budgets.organizationId, ctx.organizationId))
          .orderBy(desc(budgets.financialYear));
        return rows.map((r) => r.fy);
      });
    },

    async upsert(ctx: TenantContext, input: SetBudgetInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(budgets)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            financialYear: input.financialYear,
            kind: input.kind,
            category: input.category,
            amount: input.amount.toFixed(2),
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .onConflictDoUpdate({
            target: [budgets.organizationId, budgets.financialYear, budgets.kind, budgets.category],
            set: { amount: input.amount.toFixed(2), note: input.note ?? null },
          })
          .returning({ id: budgets.id });
        if (!row) throw new Error('budget upsert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'budget.set',
          entityType: 'budget',
          entityId: row.id,
          after: {
            financialYear: input.financialYear,
            kind: input.kind,
            category: input.category,
            amount: input.amount.toFixed(2),
          },
        });
        return row.id;
      });
    },

    async remove(ctx: TenantContext, budgetId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [existing] = await tx
          .select({ category: budgets.category })
          .from(budgets)
          .where(eq(budgets.id, budgetId))
          .limit(1);
        if (!existing) return { kind: 'not_found' as const };

        await tx.delete(budgets).where(eq(budgets.id, budgetId));
        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'budget.removed',
          entityType: 'budget',
          entityId: budgetId,
          after: { category: existing.category },
        });
        return { kind: 'ok' as const };
      });
    },
  };
}

export type BudgetRepository = ReturnType<typeof createBudgetRepository>;
