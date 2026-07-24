import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const INVENTORY_UNITS = [
  'kg',
  'g',
  'litre',
  'ml',
  'piece',
  'packet',
  'bundle',
  'other',
] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export const INVENTORY_UNIT_LABELS: Record<InventoryUnit, string> = {
  kg: 'kg',
  g: 'g',
  litre: 'litre',
  ml: 'ml',
  piece: 'piece',
  packet: 'packet',
  bundle: 'bundle',
  other: 'unit',
};

export const MOVEMENT_KINDS = ['in', 'out', 'adjust'] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(160),
  category: optionalTrimmed(120),
  unit: z.enum(INVENTORY_UNITS),
  reorderLevel: z.coerce
    .number()
    .min(0, 'Reorder level cannot be negative')
    .max(100_000_000, 'Too large')
    .optional(),
  note: optionalTrimmed(500),
});
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

/**
 * A stock movement. For 'in'/'out' the quantity is added/removed and must be
 * positive; for 'adjust' the quantity is the new absolute stock (a stock-take)
 * and may be zero.
 */
export const inventoryMovementSchema = z
  .object({
    kind: z.enum(MOVEMENT_KINDS),
    quantity: z.coerce.number().min(0, 'Quantity cannot be negative').max(100_000_000, 'Too large'),
    note: optionalTrimmed(300),
  })
  .refine((v) => v.kind === 'adjust' || v.quantity > 0, {
    message: 'Quantity must be greater than zero',
    path: ['quantity'],
  });
export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;
