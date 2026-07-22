import { and, asc, count, desc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import {
  donationCategories,
  donations,
  organizations,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { TenantContext } from '../../shared';

const totalExpr = sql<string>`coalesce(sum(${donations.amount}), '0.00')`;

/** Inclusive [from, to] date range on donatedAt; either side open. */
function rangeFilter(from: string | null, to: string | null): SQL[] {
  const conds: SQL[] = [];
  if (from) conds.push(gte(donations.donatedAt, new Date(`${from}T00:00:00`)));
  if (to) {
    const [y = 1970, m = 1, d = 1] = to.split('-').map(Number);
    conds.push(lt(donations.donatedAt, new Date(y, m - 1, d + 1)));
  }
  return conds;
}

export function createReportRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async donationSummary(ctx: TenantContext, from: string | null, to: string | null) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const inOrgRange = [eq(donations.organizationId, ctx.organizationId), ...rangeFilter(from, to)];
        const recorded = and(...inOrgRange, eq(donations.status, 'recorded'));

        const [[overall], [voided], byCategory, byMethod] = await Promise.all([
          tx.select({ total: totalExpr, count: count() }).from(donations).where(recorded),
          tx
            .select({ count: count() })
            .from(donations)
            .where(and(...inOrgRange, eq(donations.status, 'void'))),
          tx
            .select({
              label: sql<string>`coalesce(${donationCategories.name}, 'Uncategorized')`,
              total: totalExpr,
              count: count(),
            })
            .from(donations)
            .leftJoin(donationCategories, eq(donations.categoryId, donationCategories.id))
            .where(recorded)
            .groupBy(sql`coalesce(${donationCategories.name}, 'Uncategorized')`)
            .orderBy(desc(sql`sum(${donations.amount})`)),
          tx
            .select({
              label: donations.method,
              total: totalExpr,
              count: count(),
            })
            .from(donations)
            .where(recorded)
            .groupBy(donations.method)
            .orderBy(desc(sql`sum(${donations.amount})`)),
        ]);

        return {
          currency: org.currency,
          total: overall?.total ?? '0.00',
          count: overall?.count ?? 0,
          voidCount: voided?.count ?? 0,
          byCategory,
          byMethod: byMethod.map((m) => ({ ...m, label: String(m.label) })),
        };
      });
    },

    /** All donations in range (incl. void, flagged as such), oldest first. */
    async donationRows(ctx: TenantContext, from: string | null, to: string | null) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select({
            receiptNumber: donations.receiptNumber,
            donatedAt: donations.donatedAt,
            donorName: donations.donorName,
            categoryName: donationCategories.name,
            method: donations.method,
            reference: donations.reference,
            amount: donations.amount,
            currency: donations.currency,
            status: donations.status,
            voidReason: donations.voidReason,
            note: donations.note,
          })
          .from(donations)
          .leftJoin(donationCategories, eq(donations.categoryId, donationCategories.id))
          .where(and(eq(donations.organizationId, ctx.organizationId), ...rangeFilter(from, to)))
          .orderBy(asc(donations.donatedAt)),
      );
    },
  };
}

export type ReportRepository = ReturnType<typeof createReportRepository>;
