import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  donations,
  expenses,
  grants,
  newId,
  organizations,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { GrantInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

// Correlated subqueries use raw identifiers (Drizzle table interpolation
// mis-correlates inside a subquery — see the funds/accounts repositories).

const grantReceived = sql<string>`coalesce((
  select sum(d.amount) from donations d
  where d.grant_id = grants.id and d.status = 'recorded'
), 0)::numeric(14, 2)`;

const grantUtilized = sql<string>`coalesce((
  select sum(e.amount) from expenses e
  where e.grant_id = grants.id and e.status = 'recorded'
), 0)::numeric(14, 2)`;

export function createGrantRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const grantColumns = {
    id: grants.id,
    funder: grants.funder,
    title: grants.title,
    reference: grants.reference,
    sanctionedOn: grants.sanctionedOn,
    purpose: grants.purpose,
    status: grants.status,
    sanctionedAmount: grants.sanctionedAmount,
    received: grantReceived,
    utilized: grantUtilized,
  };

  const baseSelect = (tx: Tx) => tx.select(grantColumns).from(grants);

  return {
    async list(ctx: TenantContext, scope: 'active' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where = and(
          eq(grants.organizationId, ctx.organizationId),
          scope === 'active' ? eq(grants.status, 'active') : undefined,
        );
        return baseSelect(tx).where(where).orderBy(asc(grants.status), asc(grants.funder));
      });
    },

    async findById(ctx: TenantContext, grantId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx).where(eq(grants.id, grantId)).limit(1);
        return row ?? null;
      });
    },

    /** Recorded receipts and utilizations tagged to a grant, plus org currency. */
    async ledger(ctx: TenantContext, grantId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const [receipts, utilizations] = await Promise.all([
          tx
            .select({
              id: donations.id,
              ref: donations.receiptNumber,
              party: donations.donorName,
              amount: donations.amount,
              at: donations.donatedAt,
            })
            .from(donations)
            .where(and(eq(donations.grantId, grantId), eq(donations.status, 'recorded')))
            .orderBy(desc(donations.donatedAt))
            .limit(200),
          tx
            .select({
              id: expenses.id,
              ref: expenses.voucherNumber,
              party: expenses.paidTo,
              amount: expenses.amount,
              at: expenses.spentAt,
            })
            .from(expenses)
            .where(and(eq(expenses.grantId, grantId), eq(expenses.status, 'recorded')))
            .orderBy(desc(expenses.spentAt))
            .limit(200),
        ]);
        return { currency: org.currency, receipts, utilizations };
      });
    },

    async create(ctx: TenantContext, input: GrantInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(grants)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            funder: input.funder,
            title: input.title,
            reference: input.reference ?? null,
            sanctionedAmount: input.sanctionedAmount.toFixed(2),
            sanctionedOn: input.sanctionedOn ?? null,
            purpose: input.purpose ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: grants.id });
        if (!row) throw new Error('grant insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'grant.created',
          entityType: 'grant',
          entityId: row.id,
          after: { funder: input.funder, title: input.title, sanctionedAmount: input.sanctionedAmount.toFixed(2) },
        });
        return row.id;
      });
    },

    async update(ctx: TenantContext, grantId: string, input: GrantInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(grants)
          .set({
            funder: input.funder,
            title: input.title,
            reference: input.reference ?? null,
            sanctionedAmount: input.sanctionedAmount.toFixed(2),
            sanctionedOn: input.sanctionedOn ?? null,
            purpose: input.purpose ?? null,
            note: input.note ?? null,
          })
          .where(eq(grants.id, grantId))
          .returning({ id: grants.id });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'grant.updated',
          entityType: 'grant',
          entityId: grantId,
          after: { title: input.title },
        });
        return updated.id;
      });
    },

    async setStatus(ctx: TenantContext, grantId: string, status: 'active' | 'closed') {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(grants)
          .set({ status })
          .where(eq(grants.id, grantId))
          .returning({ id: grants.id, title: grants.title });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: status === 'closed' ? 'grant.closed' : 'grant.reopened',
          entityType: 'grant',
          entityId: grantId,
          after: { title: updated.title, status },
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
            activeCount: count(),
            totalUnspent: sql<string>`coalesce(sum(${grantReceived} - ${grantUtilized}), 0)::numeric(14, 2)`,
          })
          .from(grants)
          .where(and(eq(grants.organizationId, ctx.organizationId), eq(grants.status, 'active')));
        return {
          currency: org.currency,
          activeCount: row?.activeCount ?? 0,
          totalUnspent: row?.totalUnspent ?? '0.00',
        };
      });
    },

    async exportRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx).where(eq(grants.organizationId, ctx.organizationId)).orderBy(asc(grants.funder)),
      );
    },
  };
}

export type GrantRepository = ReturnType<typeof createGrantRepository>;
