export type InventoryUnit =
  | 'kg'
  | 'g'
  | 'litre'
  | 'ml'
  | 'piece'
  | 'packet'
  | 'bundle'
  | 'other';

export type MovementKind = 'in' | 'out' | 'adjust';

export interface InventoryItemSummary {
  id: string;
  name: string;
  category: string | null;
  unit: InventoryUnit;
  currentStock: string;
  reorderLevel: string | null;
  note: string | null;
  isActive: boolean;
  /** currentStock at or below reorderLevel (only when a level is set). */
  isLow: boolean;
  createdAt: Date;
}

export interface MovementSummary {
  id: string;
  kind: MovementKind;
  quantity: string;
  balanceAfter: string;
  note: string | null;
  createdAt: Date;
}

export interface InventoryStats {
  itemCount: number;
  lowStockCount: number;
}
