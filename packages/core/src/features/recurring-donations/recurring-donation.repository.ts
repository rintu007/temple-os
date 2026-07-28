import { and, asc, desc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  devotees,
  donations,
  newId,
  organizations,
  recurringDonations,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { RecurringDonationInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

// Correlated subqueries use raw identifiers (Drizzle table interpolation
// mis-correlates inside a subquery — see the funds/grants repositories).
const givenTotal = sql<string>`coalesce((
  select sum(d.amount) from donations d
  where d.recurring_donation_id = recurring_donations.id and d.status = 'recorded'
), 0)::numeric(12, 2)`;

const lastGivenAt = sql<Date | null>`(
  select max(d.donated_at) from donations d
  where d.recurring_donation_id = recurring_donations.id and d.status = 'recorded'
)`;

const fundName = sql<string | null>`(
  select f.name from funds f where f.id = recurring_donations.fund_id
)`;

export function createRecurringDonationRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const columns = {
    id: recurringDonations.id,
    donorName: recurringDonations.donorName,
    devoteeId: recurringDonations.devoteeId,
    amount: recurringDonations.amount,
    frequency: recurringDonations.frequency,
    fundId: recurringDonations.fundId,
    fundName,
    startDate: recurringDonations.startDate,
    endDate: recurringDonations.endDate,
    status: recurringDonations.status,
    givenTotal,
    lastGivenAt,
  };

  const baseSelect = (tx: Tx) => tx.select(columns).from(recurringDonations);

  return {
    async list(ctx: TenantContext, scope: 'active' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where = and(
          eq(recurringDonations.organizationId, ctx.organizationId),
          scope === 'active' ? eq(recurringDonations.status, 'active') : undefined,
        );
        return baseSelect(tx)
          .where(where)
          .orderBy(asc(recurringDonations.status), asc(recurringDonations.donorName));
      });
    },

    async findById(ctx: TenantContext, recurringId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx).where(eq(recurringDonations.id, recurringId)).limit(1);
        return row ?? null;
      });
    },

    /** Recorded donations tagged to this standing gift, plus org currency. */
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
            id: donations.id,
            receiptNumber: donations.receiptNumber,
            amount: donations.amount,
            at: donations.donatedAt,
          })
          .from(donations)
          .where(
            and(eq(donations.recurringDonationId, recurringId), eq(donations.status, 'recorded')),
          )
          .orderBy(desc(donations.donatedAt))
          .limit(200);
        return { currency: org.currency, payments: rows };
      });
    },

    async create(ctx: TenantContext, input: RecurringDonationInput) {
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

        const donorName = input.donorName || devoteeName;
        if (!donorName) return { kind: 'no_donor' as const };

        const [row] = await tx
          .insert(recurringDonations)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            devoteeId: input.devoteeId ?? null,
            donorName,
            amount: input.amount.toFixed(2),
            frequency: input.frequency,
            fundId: input.fundId ?? null,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: recurringDonations.id });
        if (!row) throw new Error('recurring donation insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'recurring_donation.created',
          entityType: 'recurring_donation',
          entityId: row.id,
          after: { donorName, amount: input.amount.toFixed(2), frequency: input.frequency },
        });
        return { kind: 'ok' as const, id: row.id };
      });
    },

    async update(ctx: TenantContext, recurringId: string, input: RecurringDonationInput) {
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
        const donorName = input.donorName || devoteeName;
        if (!donorName) return { kind: 'no_donor' as const };

        const [updated] = await tx
          .update(recurringDonations)
          .set({
            devoteeId: input.devoteeId ?? null,
            donorName,
            amount: input.amount.toFixed(2),
            frequency: input.frequency,
            fundId: input.fundId ?? null,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            note: input.note ?? null,
          })
          .where(eq(recurringDonations.id, recurringId))
          .returning({ id: recurringDonations.id });
        if (!updated) return { kind: 'not_found' as const };

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'recurring_donation.updated',
          entityType: 'recurring_donation',
          entityId: recurringId,
          after: { donorName },
        });
        return { kind: 'ok' as const, id: updated.id };
      });
    },

    async setStatus(ctx: TenantContext, recurringId: string, status: 'active' | 'paused' | 'ended') {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(recurringDonations)
          .set({ status })
          .where(eq(recurringDonations.id, recurringId))
          .returning({ id: recurringDonations.id, donorName: recurringDonations.donorName });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: `recurring_donation.${status}`,
          entityType: 'recurring_donation',
          entityId: recurringId,
          after: { donorName: updated.donorName, status },
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
          .select({ amount: recurringDonations.amount, frequency: recurringDonations.frequency })
          .from(recurringDonations)
          .where(
            and(
              eq(recurringDonations.organizationId, ctx.organizationId),
              eq(recurringDonations.status, 'active'),
            ),
          );
        return { currency: org.currency, rows };
      });
    },

    async exportRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(recurringDonations.organizationId, ctx.organizationId))
          .orderBy(asc(recurringDonations.donorName)),
      );
    },
  };
}

export type RecurringDonationRepository = ReturnType<typeof createRecurringDonationRepository>;
