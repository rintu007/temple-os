import { and, desc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  inventoryItems,
  inventoryMovements,
  newId,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { InventoryItemInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

/** Stock is numeric(14,3); work in milli-units to avoid float drift. */
function toMilli(value: string): number {
  return Math.round(Number.parseFloat(value || '0') * 1000);
}
function fromMilli(milli: number): string {
  return (milli / 1000).toFixed(3);
}

export function createInventoryRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async list(ctx: TenantContext, status: 'active' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where =
          status === 'all'
            ? eq(inventoryItems.organizationId, ctx.organizationId)
            : and(
                eq(inventoryItems.organizationId, ctx.organizationId),
                eq(inventoryItems.isActive, true),
              );
        return tx.select().from(inventoryItems).where(where).orderBy(desc(inventoryItems.createdAt));
      });
    },

    async findById(ctx: TenantContext, itemId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.id, itemId))
          .limit(1);
        return row ?? null;
      });
    },

    async listMovements(ctx: TenantContext, itemId: string) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select()
          .from(inventoryMovements)
          .where(
            and(
              eq(inventoryMovements.organizationId, ctx.organizationId),
              eq(inventoryMovements.itemId, itemId),
            ),
          )
          .orderBy(desc(inventoryMovements.createdAt))
          .limit(50),
      );
    },

    async stats(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select({
            itemCount: sql<string>`count(*)`,
            lowCount: sql<string>`count(*) filter (where ${inventoryItems.reorderLevel} is not null and ${inventoryItems.currentStock} <= ${inventoryItems.reorderLevel})`,
          })
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.organizationId, ctx.organizationId),
              eq(inventoryItems.isActive, true),
            ),
          );
        return {
          itemCount: Number(row?.itemCount ?? 0),
          lowStockCount: Number(row?.lowCount ?? 0),
        };
      });
    },

    async create(ctx: TenantContext, input: InventoryItemInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(inventoryItems)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            name: input.name,
            category: input.category ?? null,
            unit: input.unit,
            reorderLevel: input.reorderLevel !== undefined ? input.reorderLevel.toFixed(3) : null,
            note: input.note ?? null,
          })
          .returning();
        if (!row) throw new Error('inventory item insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'inventory_item.created',
          entityType: 'inventory_item',
          entityId: row.id,
          after: { name: row.name, unit: row.unit },
        });
        return row;
      });
    },

    async update(ctx: TenantContext, itemId: string, input: InventoryItemInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(inventoryItems)
          .set({
            name: input.name,
            category: input.category ?? null,
            unit: input.unit,
            reorderLevel: input.reorderLevel !== undefined ? input.reorderLevel.toFixed(3) : null,
            note: input.note ?? null,
          })
          .where(eq(inventoryItems.id, itemId))
          .returning();
        return updated ?? null;
      });
    },

    /**
     * Applies a stock movement under a row lock: 'in'/'out' adjust the balance
     * by quantity ('out' cannot go negative), 'adjust' sets it to an absolute
     * counted value. Item stock and the movement ledger update together.
     */
    async recordMovement(
      ctx: TenantContext,
      itemId: string,
      kind: 'in' | 'out' | 'adjust',
      quantity: number,
      note: string | null,
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [item] = await tx
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.id, itemId))
          .for('update')
          .limit(1);
        if (!item) return { kind: 'not_found' as const };

        const currentMilli = toMilli(item.currentStock);
        const qtyMilli = Math.round(quantity * 1000);

        let newMilli: number;
        if (kind === 'in') newMilli = currentMilli + qtyMilli;
        else if (kind === 'out') {
          newMilli = currentMilli - qtyMilli;
          if (newMilli < 0) return { kind: 'insufficient_stock' as const };
        } else newMilli = qtyMilli;

        const [updated] = await tx
          .update(inventoryItems)
          .set({ currentStock: fromMilli(newMilli) })
          .where(eq(inventoryItems.id, itemId))
          .returning();
        if (!updated) return { kind: 'not_found' as const };

        const [movement] = await tx
          .insert(inventoryMovements)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            itemId,
            kind,
            quantity: fromMilli(kind === 'adjust' ? newMilli : qtyMilli),
            balanceAfter: fromMilli(newMilli),
            note,
            recordedByUserId: ctx.userId,
          })
          .returning();
        if (!movement) throw new Error('inventory movement insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'inventory.movement',
          entityType: 'inventory_item',
          entityId: itemId,
          after: { kind, quantity, balanceAfter: movement.balanceAfter },
        });

        return { kind: 'ok' as const, item: updated, movement };
      });
    },
  };
}

export type InventoryRepository = ReturnType<typeof createInventoryRepository>;
