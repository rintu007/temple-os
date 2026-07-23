import { desc, eq } from 'drizzle-orm';
import {
  auditLogs,
  donations,
  hundiCollections,
  newId,
  organizations,
  temples,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { RecordHundiCollectionInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';
import { allocateReceiptNumber, findOrCreateCategory } from '../donations/donation.repository';

/** Hundi money files into the ledger under this donation category. */
const HUNDI_CATEGORY = 'Hundi';

export function createHundiRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    /**
     * Records one box counting: allocates a receipt, writes the donation row
     * (the money) and the hundi_collections row (the box detail) in a single
     * transaction so the ledger and the tally can never diverge. `total` is the
     * already-computed amount (denomination sum, or a direct entry).
     */
    async record(ctx: TenantContext, input: RecordHundiCollectionInput, total: number) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        if (input.templeId) {
          const [temple] = await tx
            .select({ id: temples.id })
            .from(temples)
            .where(eq(temples.id, input.templeId))
            .limit(1);
          if (!temple) return { kind: 'temple_not_found' as const };
        }

        const countedAt = input.countedOn ? new Date(`${input.countedOn}T12:00:00`) : new Date();
        const countedOn = input.countedOn ?? countedAt.toISOString().slice(0, 10);
        const amount = total.toFixed(2);

        const categoryId = await findOrCreateCategory(tx, ctx.organizationId, HUNDI_CATEGORY);
        const receiptNumber = await allocateReceiptNumber(
          tx,
          ctx.organizationId,
          countedAt.getFullYear(),
        );

        const [donation] = await tx
          .insert(donations)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            templeId: input.templeId ?? null,
            categoryId,
            donorName: input.boxName,
            amount,
            currency: org.currency,
            method: 'cash',
            note: input.note ?? null,
            receiptNumber,
            donatedAt: countedAt,
            recordedByUserId: ctx.userId,
          })
          .returning();
        if (!donation) throw new Error('hundi donation insert returned no row');

        const denominations =
          input.denominations && input.denominations.length > 0 ? input.denominations : null;

        const [collection] = await tx
          .insert(hundiCollections)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            templeId: input.templeId ?? null,
            boxName: input.boxName,
            countedOn,
            denominations,
            totalAmount: amount,
            currency: org.currency,
            note: input.note ?? null,
            donationId: donation.id,
            countedByUserId: ctx.userId,
          })
          .returning();
        if (!collection) throw new Error('hundi collection insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'hundi.collected',
          entityType: 'hundi_collection',
          entityId: collection.id,
          after: { boxName: collection.boxName, total: amount, receiptNumber },
        });

        return { kind: 'ok' as const, collection, receiptNumber };
      });
    },

    async list(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select({
            id: hundiCollections.id,
            boxName: hundiCollections.boxName,
            countedOn: hundiCollections.countedOn,
            denominations: hundiCollections.denominations,
            totalAmount: hundiCollections.totalAmount,
            currency: hundiCollections.currency,
            note: hundiCollections.note,
            createdAt: hundiCollections.createdAt,
            receiptNumber: donations.receiptNumber,
            status: donations.status,
          })
          .from(hundiCollections)
          .leftJoin(donations, eq(hundiCollections.donationId, donations.id))
          .where(eq(hundiCollections.organizationId, ctx.organizationId))
          .orderBy(desc(hundiCollections.countedOn), desc(hundiCollections.createdAt)),
      );
    },
  };
}

export type HundiRepository = ReturnType<typeof createHundiRepository>;
