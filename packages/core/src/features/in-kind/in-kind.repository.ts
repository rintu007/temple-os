import { and, count, desc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  devotees,
  inKindDonations,
  newId,
  organizations,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { InKindDonationInput, SetDispositionInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

export function createInKindRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const columns = {
    id: inKindDonations.id,
    donorName: inKindDonations.donorName,
    devoteeId: inKindDonations.devoteeId,
    category: inKindDonations.category,
    item: inKindDonations.item,
    quantity: inKindDonations.quantity,
    unit: inKindDonations.unit,
    estimatedValue: inKindDonations.estimatedValue,
    currency: inKindDonations.currency,
    receivedOn: inKindDonations.receivedOn,
    disposition: inKindDonations.disposition,
    disposalNote: inKindDonations.disposalNote,
    note: inKindDonations.note,
  };

  const baseSelect = (tx: Tx) => tx.select(columns).from(inKindDonations);

  return {
    async list(ctx: TenantContext, scope: 'in_stock' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where = and(
          eq(inKindDonations.organizationId, ctx.organizationId),
          scope === 'in_stock' ? eq(inKindDonations.disposition, 'in_stock') : undefined,
        );
        return baseSelect(tx).where(where).orderBy(desc(inKindDonations.receivedOn));
      });
    },

    async findById(ctx: TenantContext, inKindId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx).where(eq(inKindDonations.id, inKindId)).limit(1);
        return row ?? null;
      });
    },

    async create(ctx: TenantContext, input: InKindDonationInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        let donorName = input.donorName;
        if (input.devoteeId) {
          const [d] = await tx
            .select({ fullName: devotees.fullName })
            .from(devotees)
            .where(eq(devotees.id, input.devoteeId))
            .limit(1);
          if (!d) return { kind: 'devotee_not_found' as const };
          if (!donorName) donorName = d.fullName;
        }

        const [row] = await tx
          .insert(inKindDonations)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            devoteeId: input.devoteeId ?? null,
            donorName,
            category: input.category,
            item: input.item,
            quantity: input.quantity == null ? null : input.quantity.toFixed(3),
            unit: input.unit ?? null,
            estimatedValue: input.estimatedValue == null ? null : input.estimatedValue.toFixed(2),
            currency: org.currency,
            receivedOn: input.receivedOn,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: inKindDonations.id });
        if (!row) throw new Error('in-kind insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'in_kind.recorded',
          entityType: 'in_kind_donation',
          entityId: row.id,
          after: { donorName, category: input.category, item: input.item },
        });
        return { kind: 'ok' as const, id: row.id };
      });
    },

    async update(ctx: TenantContext, inKindId: string, input: InKindDonationInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(inKindDonations)
          .set({
            donorName: input.donorName,
            devoteeId: input.devoteeId ?? null,
            category: input.category,
            item: input.item,
            quantity: input.quantity == null ? null : input.quantity.toFixed(3),
            unit: input.unit ?? null,
            estimatedValue: input.estimatedValue == null ? null : input.estimatedValue.toFixed(2),
            receivedOn: input.receivedOn,
            note: input.note ?? null,
          })
          .where(eq(inKindDonations.id, inKindId))
          .returning({ id: inKindDonations.id });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'in_kind.updated',
          entityType: 'in_kind_donation',
          entityId: inKindId,
          after: { item: input.item },
        });
        return updated.id;
      });
    },

    async setDisposition(ctx: TenantContext, inKindId: string, input: SetDispositionInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(inKindDonations)
          .set({ disposition: input.disposition, disposalNote: input.disposalNote ?? null })
          .where(eq(inKindDonations.id, inKindId))
          .returning({ id: inKindDonations.id, item: inKindDonations.item });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'in_kind.disposition',
          entityType: 'in_kind_donation',
          entityId: inKindId,
          after: { item: updated.item, disposition: input.disposition },
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
            inStockCount: count(),
            inStockValue: sql<string>`coalesce(sum(${inKindDonations.estimatedValue}), 0)::numeric(14, 2)`,
          })
          .from(inKindDonations)
          .where(
            and(
              eq(inKindDonations.organizationId, ctx.organizationId),
              eq(inKindDonations.disposition, 'in_stock'),
            ),
          );
        return {
          currency: org.currency,
          inStockCount: row?.inStockCount ?? 0,
          inStockValue: row?.inStockValue ?? '0.00',
        };
      });
    },

    async exportRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(inKindDonations.organizationId, ctx.organizationId))
          .orderBy(desc(inKindDonations.receivedOn)),
      );
    },
  };
}

export type InKindRepository = ReturnType<typeof createInKindRepository>;
