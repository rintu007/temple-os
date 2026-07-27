import { and, desc, eq, gte, isNotNull, lt, sql, type AnyColumn } from 'drizzle-orm';
import {
  donationCategories,
  donations,
  expenseCategories,
  expenses,
  investments,
  loans,
  membershipSubscriptions,
  organizations,
  pledges,
  recurringExpenses,
  vendorBills,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { TenantContext } from '../../shared';

/** Due on or before 30 days from today — captures overdue and upcoming alike. */
const withinHorizon = (col: AnyColumn) => sql`${col} <= current_date + interval '30 days'`;

export function createInsightsRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async currency(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');
        return org.currency;
      });
    },

    /** Date-based candidates from every module. The service filters and formats. */
    async reminderCandidates(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const org = ctx.organizationId;

        const [pledgeRows, billRows, loanRows, investmentRows, membershipRows, recurringRows] =
          await Promise.all([
          tx
            .select({
              id: pledges.id,
              donorName: pledges.donorName,
              dueDate: pledges.dueDate,
              amount: pledges.amount,
              received: sql<string>`coalesce((select sum(d.amount) from donations d
                where d.pledge_id = pledges.id and d.status = 'recorded'), 0)::numeric(12, 2)`,
            })
            .from(pledges)
            .where(
              and(
                eq(pledges.organizationId, org),
                eq(pledges.status, 'open'),
                isNotNull(pledges.dueDate),
                withinHorizon(pledges.dueDate),
              ),
            ),
          tx
            .select({
              id: vendorBills.id,
              billNumber: vendorBills.billNumber,
              vendorName: sql<string>`(select v.name from vendors v where v.id = vendor_bills.vendor_id)`,
              dueDate: vendorBills.dueDate,
              amount: vendorBills.amount,
              paid: sql<string>`coalesce((select sum(e.amount) from expenses e
                where e.vendor_bill_id = vendor_bills.id and e.status = 'recorded'), 0)::numeric(12, 2)`,
            })
            .from(vendorBills)
            .where(
              and(
                eq(vendorBills.organizationId, org),
                eq(vendorBills.status, 'open'),
                isNotNull(vendorBills.dueDate),
                withinHorizon(vendorBills.dueDate),
              ),
            ),
          tx
            .select({
              id: loans.id,
              counterparty: loans.counterparty,
              direction: loans.direction,
              dueDate: loans.dueOn,
              principal: loans.principal,
              repaid: sql<string>`coalesce((select sum(lr.amount) from loan_repayments lr
                where lr.loan_id = loans.id), 0)::numeric(14, 2)`,
            })
            .from(loans)
            .where(
              and(
                eq(loans.organizationId, org),
                eq(loans.status, 'active'),
                isNotNull(loans.dueOn),
                withinHorizon(loans.dueOn),
              ),
            ),
          tx
            .select({
              id: investments.id,
              institution: investments.institution,
              dueDate: investments.maturityDate,
              principal: investments.principal,
              maturityValue: investments.maturityValue,
            })
            .from(investments)
            .where(
              and(
                eq(investments.organizationId, org),
                eq(investments.status, 'active'),
                isNotNull(investments.maturityDate),
                withinHorizon(investments.maturityDate),
              ),
            ),
          tx
            .select({
              id: membershipSubscriptions.id,
              memberName: membershipSubscriptions.memberName,
              planName: membershipSubscriptions.planName,
              dueDate: membershipSubscriptions.expiresOn,
              amount: membershipSubscriptions.amount,
            })
            .from(membershipSubscriptions)
            .where(
              and(
                eq(membershipSubscriptions.organizationId, org),
                eq(membershipSubscriptions.status, 'active'),
                isNotNull(membershipSubscriptions.expiresOn),
                withinHorizon(membershipSubscriptions.expiresOn),
              ),
            ),
          // Next-due is computed from the cadence in the service, so fetch all
          // active standing orders and let the service filter to the horizon.
          tx
            .select({
              id: recurringExpenses.id,
              payee: recurringExpenses.payee,
              description: recurringExpenses.description,
              amount: recurringExpenses.amount,
              frequency: recurringExpenses.frequency,
              startDate: recurringExpenses.startDate,
              endDate: recurringExpenses.endDate,
            })
            .from(recurringExpenses)
            .where(
              and(
                eq(recurringExpenses.organizationId, org),
                eq(recurringExpenses.status, 'active'),
              ),
            ),
        ]);

        return { pledgeRows, billRows, loanRows, investmentRows, membershipRows, recurringRows };
      });
    },

    /** Financial-year analytics: totals, top donors, category mixes. */
    async analytics(ctx: TenantContext, from: string, to: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const org = ctx.organizationId;
        const fromTs = new Date(`${from}T00:00:00`);
        const [ty = 1970, tm = 1, td = 1] = to.split('-').map(Number);
        const toTs = new Date(ty, tm - 1, td + 1);

        const donationWhere = and(
          eq(donations.organizationId, org),
          eq(donations.status, 'recorded'),
          gte(donations.donatedAt, fromTs),
          lt(donations.donatedAt, toTs),
        );
        const expenseWhere = and(
          eq(expenses.organizationId, org),
          eq(expenses.status, 'recorded'),
          gte(expenses.spentAt, fromTs),
          lt(expenses.spentAt, toTs),
        );

        const [[income], [expenditure], topDonors, givingByCategory, topExpenseCategories] =
          await Promise.all([
            tx
              .select({ total: sql<string>`coalesce(sum(${donations.amount}), '0.00')` })
              .from(donations)
              .where(donationWhere),
            tx
              .select({ total: sql<string>`coalesce(sum(${expenses.amount}), '0.00')` })
              .from(expenses)
              .where(expenseWhere),
            tx
              .select({
                label: donations.donorName,
                total: sql<string>`coalesce(sum(${donations.amount}), '0.00')`,
              })
              .from(donations)
              .where(donationWhere)
              .groupBy(donations.donorName)
              .orderBy(desc(sql`sum(${donations.amount})`))
              .limit(5),
            tx
              .select({
                label: sql<string>`coalesce(${donationCategories.name}, 'Uncategorized')`,
                total: sql<string>`coalesce(sum(${donations.amount}), '0.00')`,
              })
              .from(donations)
              .leftJoin(donationCategories, eq(donations.categoryId, donationCategories.id))
              .where(donationWhere)
              .groupBy(sql`coalesce(${donationCategories.name}, 'Uncategorized')`)
              .orderBy(desc(sql`sum(${donations.amount})`))
              .limit(6),
            tx
              .select({
                label: sql<string>`coalesce(${expenseCategories.name}, 'Uncategorized')`,
                total: sql<string>`coalesce(sum(${expenses.amount}), '0.00')`,
              })
              .from(expenses)
              .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
              .where(expenseWhere)
              .groupBy(sql`coalesce(${expenseCategories.name}, 'Uncategorized')`)
              .orderBy(desc(sql`sum(${expenses.amount})`))
              .limit(6),
          ]);

        return {
          income: income?.total ?? '0.00',
          expenditure: expenditure?.total ?? '0.00',
          topDonors: topDonors.map((r) => ({ label: String(r.label), total: r.total })),
          givingByCategory: givingByCategory.map((r) => ({ label: String(r.label), total: r.total })),
          topExpenseCategories: topExpenseCategories.map((r) => ({
            label: String(r.label),
            total: r.total,
          })),
        };
      });
    },
  };
}

export type InsightsRepository = ReturnType<typeof createInsightsRepository>;
