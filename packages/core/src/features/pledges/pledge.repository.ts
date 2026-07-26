import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import {
  auditLogs,
  campaigns,
  devotees,
  donations,
  newId,
  organizations,
  pledges,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { CreatePledgeInput, FulfilPledgeInput } from '@templeos/validators';
import {
  allocateReceiptNumber,
  findOrCreateCategory,
} from '../donations/donation.repository';
import type { TenantContext } from '../../shared';

// Raw-identifier correlated subqueries (Drizzle table interpolation mis-correlates
// inside a subquery — see the vendors repository for the same technique).

/** Recorded receipts applied to a given pledge — the amount received to date. */
const receivedFor = (pledgeCol: string) => sql<string>`coalesce((
  select sum(d.amount) from donations d
  where d.pledge_id = ${sql.raw(pledgeCol)} and d.status = 'recorded'
), 0)::numeric(12, 2)`;

const pledgeReceived = sql<string>`coalesce((
  select sum(d.amount) from donations d
  where d.pledge_id = pledges.id and d.status = 'recorded'
), 0)::numeric(12, 2)`;

function pledgeSearch(search: string | null): SQL | undefined {
  if (!search) return undefined;
  const term = `%${search}%`;
  return or(ilike(pledges.donorName, term), ilike(pledges.note, term));
}

export function createPledgeRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const pledgeColumns = {
    id: pledges.id,
    donorName: pledges.donorName,
    devoteeId: pledges.devoteeId,
    campaignId: pledges.campaignId,
    campaignTitle: campaigns.title,
    amount: pledges.amount,
    currency: pledges.currency,
    pledgedOn: pledges.pledgedOn,
    dueDate: pledges.dueDate,
    note: pledges.note,
    status: pledges.status,
    cancelReason: pledges.cancelReason,
    received: pledgeReceived,
  };

  const baseSelect = (tx: Tx) =>
    tx
      .select(pledgeColumns)
      .from(pledges)
      .leftJoin(campaigns, eq(pledges.campaignId, campaigns.id));

  return {
    async list(ctx: TenantContext, query: { search: string | null; scope: 'open' | 'all' }) {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where = and(
          eq(pledges.organizationId, ctx.organizationId),
          query.scope === 'open' ? eq(pledges.status, 'open') : undefined,
          pledgeSearch(query.search),
        );
        return baseSelect(tx).where(where).orderBy(desc(pledges.pledgedOn), asc(pledges.donorName));
      });
    },

    async findById(ctx: TenantContext, pledgeId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx).where(eq(pledges.id, pledgeId)).limit(1);
        return row ?? null;
      });
    },

    /** Recorded receipts that fulfil a pledge — for the detail view. */
    async fulfilments(ctx: TenantContext, pledgeId: string) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select({
            id: donations.id,
            receiptNumber: donations.receiptNumber,
            amount: donations.amount,
            method: donations.method,
            donatedAt: donations.donatedAt,
            status: donations.status,
          })
          .from(donations)
          .where(and(eq(donations.pledgeId, pledgeId), eq(donations.status, 'recorded')))
          .orderBy(desc(donations.donatedAt)),
      );
    },

    async create(ctx: TenantContext, input: CreatePledgeInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        if (input.devoteeId) {
          const [devotee] = await tx
            .select({ id: devotees.id })
            .from(devotees)
            .where(eq(devotees.id, input.devoteeId))
            .limit(1);
          if (!devotee) return { kind: 'devotee_not_found' as const };
        }

        const [row] = await tx
          .insert(pledges)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            devoteeId: input.devoteeId ?? null,
            campaignId: input.campaignId ?? null,
            donorName: input.donorName,
            amount: input.amount.toFixed(2),
            currency: org.currency,
            pledgedOn: input.pledgedOn,
            dueDate: input.dueDate ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: pledges.id });
        if (!row) throw new Error('pledge insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'pledge.created',
          entityType: 'pledge',
          entityId: row.id,
          after: { donorName: input.donorName, amount: input.amount.toFixed(2) },
        });
        return { kind: 'ok' as const, id: row.id };
      });
    },

    /**
     * Records a receipt against a pledge: inserts a real donation (linked via
     * pledgeId, category "Pledge") drawing the shared receipt sequence, so the
     * money lands in the donation ledger and reports. Received/outstanding stay
     * derived from those donations.
     */
    async fulfil(ctx: TenantContext, pledgeId: string, input: FulfilPledgeInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [pledge] = await tx
          .select({
            amount: pledges.amount,
            currency: pledges.currency,
            status: pledges.status,
            donorName: pledges.donorName,
            devoteeId: pledges.devoteeId,
            campaignId: pledges.campaignId,
          })
          .from(pledges)
          .where(eq(pledges.id, pledgeId))
          .limit(1);
        if (!pledge) return { kind: 'not_found' as const };
        if (pledge.status === 'cancelled') return { kind: 'cancelled' as const };

        const [receivedRow] = await tx
          .select({ total: sql<string>`coalesce(sum(${donations.amount}), 0)::numeric(12, 2)` })
          .from(donations)
          .where(and(eq(donations.pledgeId, pledgeId), eq(donations.status, 'recorded')));

        const toPaise = (v: string | number) => Math.round(Number(v) * 100);
        const outstandingPaise = toPaise(pledge.amount) - toPaise(receivedRow?.total ?? '0');
        if (toPaise(input.amount) > outstandingPaise) {
          return { kind: 'overpay' as const, outstanding: (outstandingPaise / 100).toFixed(2) };
        }

        const donatedAt = input.receivedOn ? new Date(`${input.receivedOn}T12:00:00`) : new Date();
        const receiptNumber = await allocateReceiptNumber(
          tx,
          ctx.organizationId,
          donatedAt.getFullYear(),
        );
        const categoryId = await findOrCreateCategory(tx, ctx.organizationId, 'Pledge');

        const [donation] = await tx
          .insert(donations)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            devoteeId: pledge.devoteeId,
            campaignId: pledge.campaignId,
            categoryId,
            pledgeId,
            donorName: pledge.donorName,
            amount: input.amount.toFixed(2),
            currency: pledge.currency,
            method: input.method,
            reference: input.reference ?? null,
            note: input.note ?? null,
            receiptNumber,
            donatedAt,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: donations.id });
        if (!donation) throw new Error('pledge fulfilment donation returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'pledge.fulfilled',
          entityType: 'pledge',
          entityId: pledgeId,
          after: { receiptNumber, amount: input.amount.toFixed(2) },
        });
        return { kind: 'ok' as const, receiptNumber, donationId: donation.id };
      });
    },

    async cancel(ctx: TenantContext, pledgeId: string, reason: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [current] = await tx
          .select({ status: pledges.status, donorName: pledges.donorName })
          .from(pledges)
          .where(eq(pledges.id, pledgeId))
          .limit(1);
        if (!current) return { kind: 'not_found' as const };
        if (current.status === 'cancelled') return { kind: 'already_cancelled' as const };

        await tx
          .update(pledges)
          .set({ status: 'cancelled', cancelReason: reason })
          .where(eq(pledges.id, pledgeId));

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'pledge.cancelled',
          entityType: 'pledge',
          entityId: pledgeId,
          after: { donorName: current.donorName, reason },
        });
        return { kind: 'ok' as const };
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

        const outstandingExpr = sql<string>`pledges.amount - ${receivedFor('pledges.id')}`;
        const [row] = await tx
          .select({
            pledged: sql<string>`coalesce(sum(${pledges.amount}), 0)::numeric(12, 2)`,
            outstanding: sql<string>`coalesce(sum(${outstandingExpr}), 0)::numeric(12, 2)`,
            overdue: sql<string>`coalesce(sum(${outstandingExpr}) filter (
              where ${pledges.dueDate} is not null and ${pledges.dueDate} < current_date
            ), 0)::numeric(12, 2)`,
            openCount: count(),
          })
          .from(pledges)
          .where(and(eq(pledges.organizationId, ctx.organizationId), eq(pledges.status, 'open')));

        return {
          currency: org.currency,
          totalPledged: row?.pledged ?? '0.00',
          totalOutstanding: row?.outstanding ?? '0.00',
          overdueOutstanding: row?.overdue ?? '0.00',
          openCount: row?.openCount ?? 0,
        };
      });
    },

    async exportRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(pledges.organizationId, ctx.organizationId))
          .orderBy(desc(pledges.pledgedOn)),
      );
    },
  };
}

export type PledgeRepository = ReturnType<typeof createPledgeRepository>;
