import type { Db } from '@templeos/db';
import { inventoryItemSchema, inventoryMovementSchema } from '@templeos/validators';
import {
  authorize,
  conflict,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createInventoryRepository } from './inventory.repository';
import type {
  InventoryItemSummary,
  InventoryStats,
  MovementKind,
  MovementSummary,
} from './inventory.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

function isLow(currentStock: string, reorderLevel: string | null): boolean {
  if (reorderLevel === null) return false;
  return Math.round(Number.parseFloat(currentStock) * 1000) <=
    Math.round(Number.parseFloat(reorderLevel) * 1000);
}

function toItem(row: {
  id: string;
  name: string;
  category: string | null;
  unit: InventoryItemSummary['unit'];
  currentStock: string;
  reorderLevel: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: Date;
}): InventoryItemSummary {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    currentStock: row.currentStock,
    reorderLevel: row.reorderLevel,
    note: row.note,
    isActive: row.isActive,
    isLow: isLow(row.currentStock, row.reorderLevel),
    createdAt: row.createdAt,
  };
}

function toMovement(row: {
  id: string;
  kind: MovementKind;
  quantity: string;
  balanceAfter: string;
  note: string | null;
  createdAt: Date;
}): MovementSummary {
  return {
    id: row.id,
    kind: row.kind,
    quantity: row.quantity,
    balanceAfter: row.balanceAfter,
    note: row.note,
    createdAt: row.createdAt,
  };
}

export function createInventoryService({ db }: { db: Db }) {
  const repo = createInventoryRepository(db);

  return {
    async listItems(
      ctx: TenantContext,
      status: 'active' | 'all' = 'active',
    ): Promise<Result<InventoryItemSummary[]>> {
      const auth = authorize(ctx, 'inventory:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx, status);
      return ok(rows.map(toItem));
    },

    async getItem(ctx: TenantContext, itemId: string): Promise<Result<InventoryItemSummary>> {
      const auth = authorize(ctx, 'inventory:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, itemId);
      if (!row) return err(notFound('Item'));
      return ok(toItem(row));
    },

    async getStats(ctx: TenantContext): Promise<Result<InventoryStats>> {
      const auth = authorize(ctx, 'inventory:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx));
    },

    async listMovements(
      ctx: TenantContext,
      itemId: string,
    ): Promise<Result<MovementSummary[]>> {
      const auth = authorize(ctx, 'inventory:read');
      if (!auth.ok) return auth;
      const rows = await repo.listMovements(ctx, itemId);
      return ok(rows.map(toMovement));
    },

    async createItem(ctx: TenantContext, rawInput: unknown): Promise<Result<InventoryItemSummary>> {
      const auth = authorize(ctx, 'inventory:write');
      if (!auth.ok) return auth;
      const parsed = inventoryItemSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const row = await repo.create(ctx, parsed.data);
      return ok(toItem(row));
    },

    async updateItem(
      ctx: TenantContext,
      itemId: string,
      rawInput: unknown,
    ): Promise<Result<InventoryItemSummary>> {
      const auth = authorize(ctx, 'inventory:write');
      if (!auth.ok) return auth;
      const parsed = inventoryItemSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const updated = await repo.update(ctx, itemId, parsed.data);
      if (!updated) return err(notFound('Item'));
      return ok(toItem(updated));
    },

    async recordMovement(
      ctx: TenantContext,
      itemId: string,
      rawInput: unknown,
    ): Promise<Result<InventoryItemSummary>> {
      const auth = authorize(ctx, 'inventory:write');
      if (!auth.ok) return auth;
      const parsed = inventoryMovementSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const result = await repo.recordMovement(
        ctx,
        itemId,
        parsed.data.kind,
        parsed.data.quantity,
        parsed.data.note ?? null,
      );
      if (result.kind === 'not_found') return err(notFound('Item'));
      if (result.kind === 'insufficient_stock') {
        return err(conflict('Not enough stock for that issue'));
      }
      return ok(toItem(result.item));
    },
  };
}

export type InventoryService = ReturnType<typeof createInventoryService>;
