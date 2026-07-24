import { boolean, index, numeric, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { organizations, temples } from './tenancy';

export const inventoryUnitEnum = pgEnum('inventory_unit', [
  'kg',
  'g',
  'litre',
  'ml',
  'piece',
  'packet',
  'bundle',
  'other',
]);

export const inventoryMovementKindEnum = pgEnum('inventory_movement_kind', ['in', 'out', 'adjust']);

/**
 * A stocked item in the temple store / kitchen — pooja supplies (camphor,
 * oil, flowers) and prasadam ingredients (rice, ghee). currentStock is
 * denormalized for fast reads and kept in lockstep with the movement ledger,
 * which is the source of truth. numeric(14,3) allows fractional kg/litre.
 */
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    name: text().notNull(),
    category: text(),
    unit: inventoryUnitEnum().notNull(),
    currentStock: numeric({ precision: 14, scale: 3 }).notNull().default('0'),
    reorderLevel: numeric({ precision: 14, scale: 3 }),
    note: text(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [index('inventory_items_org_idx').on(t.organizationId)],
);

/**
 * An append-only stock movement. 'in' and 'out' change stock by quantity;
 * 'adjust' sets stock to an absolute counted value (stock-take). balanceAfter
 * snapshots the resulting stock so history is self-describing.
 */
export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    itemId: uuid()
      .notNull()
      .references(() => inventoryItems.id),
    kind: inventoryMovementKindEnum().notNull(),
    quantity: numeric({ precision: 14, scale: 3 }).notNull(),
    balanceAfter: numeric({ precision: 14, scale: 3 }).notNull(),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('inventory_movements_item_idx').on(t.itemId, t.createdAt)],
);
