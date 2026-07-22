import { and, count, desc, eq, gte, ilike, or, sql, type SQL } from 'drizzle-orm';
import {
  auditLogs,
  devotees,
  donationCategories,
  donationCounters,
  donations,
  newId,
  organizations,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { RecordDonationInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

function searchFilter(search: string | null): SQL | undefined {
  if (!search) return undefined;
  const term = `%${search}%`;
  return or(ilike(donations.donorName, term), ilike(donations.receiptNumber, term));
}

/** Shared with the payments feature — online donations file into the same category set. */
export async function findOrCreateCategory(
  tx: Tx,
  organizationId: string,
  name: string,
): Promise<string> {
  const [existing] = await tx
    .select({ id: donationCategories.id })
    .from(donationCategories)
    .where(
      and(
        eq(donationCategories.organizationId, organizationId),
        sql`lower(${donationCategories.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const [created] = await tx
    .insert(donationCategories)
    .values({ id: newId(), organizationId, name })
    .returning({ id: donationCategories.id });
  if (!created) throw new Error('category insert returned no row');
  return created.id;
}

/**
 * Allocates the next org-scoped receipt sequence number atomically. Shared
 * with the payments feature so manual and online donations share one
 * continuous per-organization sequence.
 */
export async function allocateReceiptNumber(tx: Tx, organizationId: string, year: number) {
  const [counter] = await tx
    .insert(donationCounters)
    .values({ organizationId, nextNumber: 2 })
    .onConflictDoUpdate({
      target: donationCounters.organizationId,
      set: { nextNumber: sql`${donationCounters.nextNumber} + 1` },
    })
    .returning({ nextNumber: donationCounters.nextNumber });
  if (!counter) throw new Error('receipt counter returned no row');
  const seq = counter.nextNumber - 1;
  return `${year}-${String(seq).padStart(5, '0')}`;
}

export function createDonationRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const baseSelect = (tx: Tx) =>
    tx
      .select({
        id: donations.id,
        receiptNumber: donations.receiptNumber,
        donorName: donations.donorName,
        devoteeId: donations.devoteeId,
        devoteeName: devotees.fullName,
        categoryName: donationCategories.name,
        amount: donations.amount,
        currency: donations.currency,
        method: donations.method,
        reference: donations.reference,
        note: donations.note,
        donatedAt: donations.donatedAt,
        status: donations.status,
        voidReason: donations.voidReason,
      })
      .from(donations)
      .leftJoin(devotees, eq(donations.devoteeId, devotees.id))
      .leftJoin(donationCategories, eq(donations.categoryId, donationCategories.id));

  return {
    async record(ctx: TenantContext, input: RecordDonationInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        let devoteeName: string | null = null;
        if (input.devoteeId) {
          const [devotee] = await tx
            .select({ fullName: devotees.fullName })
            .from(devotees)
            .where(eq(devotees.id, input.devoteeId))
            .limit(1);
          if (!devotee) return { kind: 'devotee_not_found' as const };
          devoteeName = devotee.fullName;
        }

        const donorName = input.donorName ?? devoteeName;
        if (!donorName) return { kind: 'no_donor' as const };

        const categoryId = input.categoryName
          ? await findOrCreateCategory(tx, ctx.organizationId, input.categoryName)
          : null;

        const donatedAt = input.donatedOn ? new Date(`${input.donatedOn}T12:00:00`) : new Date();
        const receiptNumber = await allocateReceiptNumber(
          tx,
          ctx.organizationId,
          donatedAt.getFullYear(),
        );

        const [donation] = await tx
          .insert(donations)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            devoteeId: input.devoteeId ?? null,
            categoryId,
            donorName,
            amount: input.amount.toFixed(2),
            currency: org.currency,
            method: input.method,
            reference: input.reference ?? null,
            note: input.note ?? null,
            receiptNumber,
            donatedAt,
            recordedByUserId: ctx.userId,
          })
          .returning();
        if (!donation) throw new Error('donation insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'donation.recorded',
          entityType: 'donation',
          entityId: donation.id,
          after: {
            receiptNumber,
            donorName,
            amount: donation.amount,
            method: donation.method,
          },
        });

        return { kind: 'ok' as const, donation: { ...donation, devoteeName } };
      });
    },

    async list(
      ctx: TenantContext,
      query: { search: string | null; page: number; pageSize: number },
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const where = and(
          eq(donations.organizationId, ctx.organizationId),
          searchFilter(query.search),
        );
        const [items, [totalRow]] = await Promise.all([
          baseSelect(tx)
            .where(where)
            .orderBy(desc(donations.donatedAt))
            .limit(query.pageSize)
            .offset((query.page - 1) * query.pageSize),
          tx.select({ value: count() }).from(donations).where(where),
        ]);
        return { items, total: totalRow?.value ?? 0 };
      });
    },

    async findById(ctx: TenantContext, donationId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx).where(eq(donations.id, donationId)).limit(1);
        return row ?? null;
      });
    },

    async void(ctx: TenantContext, donationId: string, reason: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [current] = await tx
          .select({ status: donations.status, receiptNumber: donations.receiptNumber })
          .from(donations)
          .where(eq(donations.id, donationId))
          .limit(1);
        if (!current) return { kind: 'not_found' as const };
        if (current.status === 'void') return { kind: 'already_void' as const };

        await tx
          .update(donations)
          .set({ status: 'void', voidReason: reason })
          .where(eq(donations.id, donationId));

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'donation.voided',
          entityType: 'donation',
          entityId: donationId,
          after: { receiptNumber: current.receiptNumber, reason },
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

        const recorded = and(
          eq(donations.organizationId, ctx.organizationId),
          eq(donations.status, 'recorded'),
        );
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [[allTime], [month]] = await Promise.all([
          tx
            .select({ total: sql<string>`coalesce(sum(${donations.amount}), '0.00')` })
            .from(donations)
            .where(recorded),
          tx
            .select({
              total: sql<string>`coalesce(sum(${donations.amount}), '0.00')`,
              count: count(),
            })
            .from(donations)
            .where(and(recorded, gte(donations.donatedAt, monthStart))),
        ]);

        return {
          currency: org.currency,
          allTimeTotal: allTime?.total ?? '0.00',
          monthTotal: month?.total ?? '0.00',
          monthCount: month?.count ?? 0,
        };
      });
    },
  };
}

export type DonationRepository = ReturnType<typeof createDonationRepository>;
