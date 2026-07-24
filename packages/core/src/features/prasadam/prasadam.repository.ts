import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import {
  auditLogs,
  donations,
  newId,
  organizations,
  prasadamSessions,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { RecordPrasadamInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';
import { allocateReceiptNumber, findOrCreateCategory } from '../donations/donation.repository';

const SPONSOR_CATEGORY = 'Annadanam Sponsorship';

export function createPrasadamRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    /**
     * Logs a serving session. When `sponsorAmount` is positive, a sponsorship
     * donation (income + receipt) is written and linked in the same
     * transaction so sponsorship money always reaches the ledger.
     */
    async record(ctx: TenantContext, input: RecordPrasadamInput, sponsorAmount: number) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const servedOn = input.servedOn ?? new Date().toISOString().slice(0, 10);

        let sponsorDonationId: string | null = null;
        if (sponsorAmount > 0) {
          const [org] = await tx
            .select({ currency: organizations.currency })
            .from(organizations)
            .where(eq(organizations.id, ctx.organizationId))
            .limit(1);
          if (!org) throw new Error('organization not visible in tenant context');

          const categoryId = await findOrCreateCategory(tx, ctx.organizationId, SPONSOR_CATEGORY);
          const receiptNumber = await allocateReceiptNumber(
            tx,
            ctx.organizationId,
            new Date(`${servedOn}T12:00:00`).getFullYear(),
          );
          const [donation] = await tx
            .insert(donations)
            .values({
              id: newId(),
              organizationId: ctx.organizationId,
              categoryId,
              donorName: input.sponsorName ?? 'Annadanam Sponsor',
              amount: sponsorAmount.toFixed(2),
              currency: org.currency,
              method: 'cash',
              note: `${SPONSOR_CATEGORY} — ${servedOn}`,
              receiptNumber,
              donatedAt: new Date(`${servedOn}T12:00:00`),
              recordedByUserId: ctx.userId,
            })
            .returning();
          if (!donation) throw new Error('sponsorship donation insert returned no row');
          sponsorDonationId = donation.id;
        }

        const [session] = await tx
          .insert(prasadamSessions)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            servedOn,
            meal: input.meal,
            servedCount: input.servedCount,
            sponsorName: input.sponsorName ?? null,
            sponsorDonationId,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning();
        if (!session) throw new Error('prasadam session insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'prasadam.served',
          entityType: 'prasadam_session',
          entityId: session.id,
          after: { meal: session.meal, servedCount: session.servedCount, servedOn },
        });

        return { session, sponsorDonationId };
      });
    },

    async list(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select({
            id: prasadamSessions.id,
            servedOn: prasadamSessions.servedOn,
            meal: prasadamSessions.meal,
            servedCount: prasadamSessions.servedCount,
            sponsorName: prasadamSessions.sponsorName,
            note: prasadamSessions.note,
            createdAt: prasadamSessions.createdAt,
            sponsorReceiptNumber: donations.receiptNumber,
            sponsorAmount: donations.amount,
            currency: donations.currency,
          })
          .from(prasadamSessions)
          .leftJoin(donations, eq(prasadamSessions.sponsorDonationId, donations.id))
          .where(eq(prasadamSessions.organizationId, ctx.organizationId))
          .orderBy(desc(prasadamSessions.servedOn), desc(prasadamSessions.createdAt)),
      );
    },

    async stats(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
          .toISOString()
          .slice(0, 10);
        const todayIso = now.toISOString().slice(0, 10);
        const org = eq(prasadamSessions.organizationId, ctx.organizationId);

        const [[month], [today]] = await Promise.all([
          tx
            .select({
              meals: sql<string>`coalesce(sum(${prasadamSessions.servedCount}), 0)`,
              sessions: count(),
            })
            .from(prasadamSessions)
            .where(and(org, gte(prasadamSessions.servedOn, monthStart))),
          tx
            .select({ meals: sql<string>`coalesce(sum(${prasadamSessions.servedCount}), 0)` })
            .from(prasadamSessions)
            .where(and(org, eq(prasadamSessions.servedOn, todayIso))),
        ]);

        return {
          todayMeals: Number(today?.meals ?? 0),
          monthMeals: Number(month?.meals ?? 0),
          monthSessions: month?.sessions ?? 0,
        };
      });
    },
  };
}

export type PrasadamRepository = ReturnType<typeof createPrasadamRepository>;
