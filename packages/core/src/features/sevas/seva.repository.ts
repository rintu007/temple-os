import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  devotees,
  donations,
  newId,
  organizations,
  sevaSubscriptions,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { SevaSubscriptionInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

// Correlated subqueries use raw identifiers (Drizzle table interpolation
// mis-correlates inside a subquery — see the funds/grants repositories).

const sevaCollected = sql<string>`coalesce((
  select sum(d.amount) from donations d
  where d.seva_subscription_id = seva_subscriptions.id and d.status = 'recorded'
), 0)::numeric(12, 2)`;

const sevaLastPaidAt = sql<Date | null>`(
  select max(d.donated_at) from donations d
  where d.seva_subscription_id = seva_subscriptions.id and d.status = 'recorded'
)`;

export function createSevaRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const columns = {
    id: sevaSubscriptions.id,
    sponsorName: sevaSubscriptions.sponsorName,
    devoteeId: sevaSubscriptions.devoteeId,
    sevaName: sevaSubscriptions.sevaName,
    amount: sevaSubscriptions.amount,
    frequency: sevaSubscriptions.frequency,
    occasion: sevaSubscriptions.occasion,
    startDate: sevaSubscriptions.startDate,
    endDate: sevaSubscriptions.endDate,
    status: sevaSubscriptions.status,
    collected: sevaCollected,
    lastPaidAt: sevaLastPaidAt,
  };

  const baseSelect = (tx: Tx) => tx.select(columns).from(sevaSubscriptions);

  return {
    async list(ctx: TenantContext, scope: 'active' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where = and(
          eq(sevaSubscriptions.organizationId, ctx.organizationId),
          scope === 'active' ? eq(sevaSubscriptions.status, 'active') : undefined,
        );
        return baseSelect(tx)
          .where(where)
          .orderBy(asc(sevaSubscriptions.status), asc(sevaSubscriptions.sponsorName));
      });
    },

    async findById(ctx: TenantContext, sevaId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx).where(eq(sevaSubscriptions.id, sevaId)).limit(1);
        return row ?? null;
      });
    },

    /** Recorded donations tagged to a seva — the collection history, plus currency. */
    async payments(ctx: TenantContext, sevaId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const rows = await tx
          .select({
            id: donations.id,
            receiptNumber: donations.receiptNumber,
            amount: donations.amount,
            at: donations.donatedAt,
          })
          .from(donations)
          .where(and(eq(donations.sevaSubscriptionId, sevaId), eq(donations.status, 'recorded')))
          .orderBy(desc(donations.donatedAt))
          .limit(200);
        return { currency: org.currency, rows };
      });
    },

    async create(ctx: TenantContext, input: SevaSubscriptionInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        let devoteeName: string | null = null;
        if (input.devoteeId) {
          const [d] = await tx
            .select({ fullName: devotees.fullName })
            .from(devotees)
            .where(eq(devotees.id, input.devoteeId))
            .limit(1);
          if (!d) return { kind: 'devotee_not_found' as const };
          devoteeName = d.fullName;
        }

        const [row] = await tx
          .insert(sevaSubscriptions)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            devoteeId: input.devoteeId ?? null,
            sponsorName: input.sponsorName || (devoteeName ?? ''),
            sevaName: input.sevaName,
            amount: input.amount.toFixed(2),
            frequency: input.frequency,
            occasion: input.occasion ?? null,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: sevaSubscriptions.id });
        if (!row) throw new Error('seva insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'seva.created',
          entityType: 'seva_subscription',
          entityId: row.id,
          after: { sevaName: input.sevaName, frequency: input.frequency },
        });
        return { kind: 'ok' as const, id: row.id };
      });
    },

    async update(ctx: TenantContext, sevaId: string, input: SevaSubscriptionInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(sevaSubscriptions)
          .set({
            sponsorName: input.sponsorName,
            devoteeId: input.devoteeId ?? null,
            sevaName: input.sevaName,
            amount: input.amount.toFixed(2),
            frequency: input.frequency,
            occasion: input.occasion ?? null,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            note: input.note ?? null,
          })
          .where(eq(sevaSubscriptions.id, sevaId))
          .returning({ id: sevaSubscriptions.id });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'seva.updated',
          entityType: 'seva_subscription',
          entityId: sevaId,
          after: { sevaName: input.sevaName },
        });
        return updated.id;
      });
    },

    async setStatus(ctx: TenantContext, sevaId: string, status: 'active' | 'paused' | 'ended') {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(sevaSubscriptions)
          .set({ status })
          .where(eq(sevaSubscriptions.id, sevaId))
          .returning({ id: sevaSubscriptions.id, sevaName: sevaSubscriptions.sevaName });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: `seva.${status}`,
          entityType: 'seva_subscription',
          entityId: sevaId,
          after: { sevaName: updated.sevaName, status },
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
            perCycleValue: sql<string>`coalesce(sum(${sevaSubscriptions.amount}), 0)::numeric(12, 2)`,
          })
          .from(sevaSubscriptions)
          .where(
            and(
              eq(sevaSubscriptions.organizationId, ctx.organizationId),
              eq(sevaSubscriptions.status, 'active'),
            ),
          );
        return {
          currency: org.currency,
          activeCount: row?.activeCount ?? 0,
          perCycleValue: row?.perCycleValue ?? '0.00',
        };
      });
    },

    async exportRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(sevaSubscriptions.organizationId, ctx.organizationId))
          .orderBy(asc(sevaSubscriptions.sponsorName)),
      );
    },
  };
}

export type SevaRepository = ReturnType<typeof createSevaRepository>;
