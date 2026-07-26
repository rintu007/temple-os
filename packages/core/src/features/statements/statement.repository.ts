import { and, desc, eq, gte, lt, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import {
  assets,
  donationCategories,
  donations,
  expenseCategories,
  expenses,
  financialAccounts,
  funds,
  organizations,
  vendorBills,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { TenantContext } from '../../shared';

/** Inclusive [from, to] on a timestamp column; either side may be open. */
function rangeConds(column: AnyColumn, from: string | null, to: string | null): SQL[] {
  const conds: SQL[] = [];
  if (from) conds.push(gte(column, new Date(`${from}T00:00:00`)));
  if (to) {
    const [y = 1970, m = 1, d = 1] = to.split('-').map(Number);
    conds.push(lt(column, new Date(y, m - 1, d + 1)));
  }
  return conds;
}

export function createStatementRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async incomeAndExpenditure(ctx: TenantContext, from: string | null, to: string | null) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const donationRecorded = and(
          eq(donations.organizationId, ctx.organizationId),
          eq(donations.status, 'recorded'),
          ...rangeConds(donations.donatedAt, from, to),
        );
        const expenseRecorded = and(
          eq(expenses.organizationId, ctx.organizationId),
          eq(expenses.status, 'recorded'),
          ...rangeConds(expenses.spentAt, from, to),
        );

        const [income, expenditure] = await Promise.all([
          tx
            .select({
              label: sql<string>`coalesce(${donationCategories.name}, 'Uncategorized')`,
              total: sql<string>`coalesce(sum(${donations.amount}), '0.00')`,
            })
            .from(donations)
            .leftJoin(donationCategories, eq(donations.categoryId, donationCategories.id))
            .where(donationRecorded)
            .groupBy(sql`coalesce(${donationCategories.name}, 'Uncategorized')`)
            .orderBy(desc(sql`sum(${donations.amount})`)),
          tx
            .select({
              label: sql<string>`coalesce(${expenseCategories.name}, 'Uncategorized')`,
              total: sql<string>`coalesce(sum(${expenses.amount}), '0.00')`,
            })
            .from(expenses)
            .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
            .where(expenseRecorded)
            .groupBy(sql`coalesce(${expenseCategories.name}, 'Uncategorized')`)
            .orderBy(desc(sql`sum(${expenses.amount})`)),
        ]);

        return {
          currency: org.currency,
          income: income.map((r) => ({ label: String(r.label), total: r.total })),
          expenditure: expenditure.map((r) => ({ label: String(r.label), total: r.total })),
        };
      });
    },

    /**
     * Cash & bank position for a Receipts & Payments account: the base opening
     * balance across all accounts, plus everything received and paid *before*
     * the period start so the opening balance rolls forward correctly. When
     * `from` is null the period is open-ended and only the base applies.
     */
    async cashPosition(ctx: TenantContext, from: string | null) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [base] = await tx
          .select({
            total: sql<string>`coalesce(sum(${financialAccounts.openingBalance}), '0.00')`,
          })
          .from(financialAccounts)
          .where(eq(financialAccounts.organizationId, ctx.organizationId));

        let priorReceipts = '0.00';
        let priorPayments = '0.00';
        if (from) {
          const before = new Date(`${from}T00:00:00`);
          const [pr] = await tx
            .select({ total: sql<string>`coalesce(sum(${donations.amount}), '0.00')` })
            .from(donations)
            .where(
              and(
                eq(donations.organizationId, ctx.organizationId),
                eq(donations.status, 'recorded'),
                lt(donations.donatedAt, before),
              ),
            );
          const [pp] = await tx
            .select({ total: sql<string>`coalesce(sum(${expenses.amount}), '0.00')` })
            .from(expenses)
            .where(
              and(
                eq(expenses.organizationId, ctx.organizationId),
                eq(expenses.status, 'recorded'),
                lt(expenses.spentAt, before),
              ),
            );
          priorReceipts = pr?.total ?? '0.00';
          priorPayments = pp?.total ?? '0.00';
        }

        return { openingBase: base?.total ?? '0.00', priorReceipts, priorPayments };
      });
    },

    /**
     * The components of a Statement of Financial Position (balance sheet), all
     * derived from the ledger: current cash & bank, fixed assets at book value,
     * outstanding payables, and earmarked fund balances. The general fund is
     * left for the service to compute as the balancing figure.
     */
    async financialPosition(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const [[cashBase], [recdDonations], [recdExpenses], [fixed], [payable], fundRows] =
          await Promise.all([
            tx
              .select({
                total: sql<string>`coalesce(sum(${financialAccounts.openingBalance}), '0.00')`,
              })
              .from(financialAccounts)
              .where(eq(financialAccounts.organizationId, ctx.organizationId)),
            tx
              .select({ total: sql<string>`coalesce(sum(${donations.amount}), '0.00')` })
              .from(donations)
              .where(
                and(
                  eq(donations.organizationId, ctx.organizationId),
                  eq(donations.status, 'recorded'),
                ),
              ),
            tx
              .select({ total: sql<string>`coalesce(sum(${expenses.amount}), '0.00')` })
              .from(expenses)
              .where(
                and(eq(expenses.organizationId, ctx.organizationId), eq(expenses.status, 'recorded')),
              ),
            tx
              .select({ total: sql<string>`coalesce(sum(${assets.estimatedValue}), '0.00')` })
              .from(assets)
              .where(and(eq(assets.organizationId, ctx.organizationId), eq(assets.status, 'active'))),
            tx
              .select({
                total: sql<string>`coalesce(sum(${vendorBills.amount} - coalesce((
                  select sum(e.amount) from expenses e
                  where e.vendor_bill_id = vendor_bills.id and e.status = 'recorded'
                ), 0)), '0.00')::numeric(12, 2)`,
              })
              .from(vendorBills)
              .where(
                and(eq(vendorBills.organizationId, ctx.organizationId), eq(vendorBills.status, 'open')),
              ),
            tx
              .select({
                name: funds.name,
                balance: sql<string>`(
                  coalesce((select sum(d.amount) from donations d
                    where d.fund_id = funds.id and d.status = 'recorded'), 0)
                  - coalesce((select sum(e.amount) from expenses e
                    where e.fund_id = funds.id and e.status = 'recorded'), 0)
                )::numeric(12, 2)`,
              })
              .from(funds)
              .where(and(eq(funds.organizationId, ctx.organizationId), eq(funds.isActive, true))),
          ]);

        return {
          currency: org.currency,
          cashBase: cashBase?.total ?? '0.00',
          donationsTotal: recdDonations?.total ?? '0.00',
          expensesTotal: recdExpenses?.total ?? '0.00',
          fixedAssets: fixed?.total ?? '0.00',
          payables: payable?.total ?? '0.00',
          funds: fundRows.map((f) => ({ name: f.name, balance: f.balance })),
        };
      });
    },
  };
}

export type StatementRepository = ReturnType<typeof createStatementRepository>;
