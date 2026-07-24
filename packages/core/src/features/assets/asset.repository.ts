import { and, desc, eq, sql } from 'drizzle-orm';
import {
  assets,
  auditLogs,
  newId,
  organizations,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { AssetInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

export function createAssetRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async list(ctx: TenantContext, status: 'active' | 'disposed' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where =
          status === 'all'
            ? eq(assets.organizationId, ctx.organizationId)
            : and(eq(assets.organizationId, ctx.organizationId), eq(assets.status, status));
        return tx.select().from(assets).where(where).orderBy(desc(assets.createdAt));
      });
    },

    async findById(ctx: TenantContext, assetId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx.select().from(assets).where(eq(assets.id, assetId)).limit(1);
        return row ?? null;
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
            count: sql<string>`count(*)`,
            value: sql<string>`coalesce(sum(coalesce(${assets.estimatedValue}, 0) * ${assets.quantity}), 0)`,
          })
          .from(assets)
          .where(and(eq(assets.organizationId, ctx.organizationId), eq(assets.status, 'active')));

        return {
          currency: org.currency,
          activeCount: Number(row?.count ?? 0),
          activeValue: Number(row?.value ?? 0).toFixed(2),
        };
      });
    },

    async create(ctx: TenantContext, input: AssetInput, currency: 'INR' | 'BDT') {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(assets)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            name: input.name,
            category: input.category,
            description: input.description ?? null,
            quantity: input.quantity,
            estimatedValue: input.estimatedValue !== undefined ? input.estimatedValue.toFixed(2) : null,
            currency,
            acquiredOn: input.acquiredOn ?? null,
            location: input.location ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning();
        if (!row) throw new Error('asset insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'asset.created',
          entityType: 'asset',
          entityId: row.id,
          after: { name: row.name, category: row.category, estimatedValue: row.estimatedValue },
        });
        return row;
      });
    },

    async update(ctx: TenantContext, assetId: string, input: AssetInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [existing] = await tx.select().from(assets).where(eq(assets.id, assetId)).limit(1);
        if (!existing) return null;

        const [updated] = await tx
          .update(assets)
          .set({
            name: input.name,
            category: input.category,
            description: input.description ?? null,
            quantity: input.quantity,
            estimatedValue: input.estimatedValue !== undefined ? input.estimatedValue.toFixed(2) : null,
            acquiredOn: input.acquiredOn ?? null,
            location: input.location ?? null,
            note: input.note ?? null,
          })
          .where(eq(assets.id, assetId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'asset.updated',
          entityType: 'asset',
          entityId: assetId,
          before: { name: existing.name, estimatedValue: existing.estimatedValue },
          after: { name: updated.name, estimatedValue: updated.estimatedValue },
        });
        return updated;
      });
    },

    async dispose(ctx: TenantContext, assetId: string, reason: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [existing] = await tx.select().from(assets).where(eq(assets.id, assetId)).limit(1);
        if (!existing) return null;
        if (existing.status === 'disposed') return existing;

        const [updated] = await tx
          .update(assets)
          .set({ status: 'disposed', disposalReason: reason })
          .where(eq(assets.id, assetId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'asset.disposed',
          entityType: 'asset',
          entityId: assetId,
          before: { name: existing.name, status: existing.status },
          after: { status: 'disposed', reason },
        });
        return updated;
      });
    },
  };
}

export type AssetRepository = ReturnType<typeof createAssetRepository>;
