export type InKindCategory = 'gold' | 'silver' | 'jewellery' | 'grain' | 'cloth' | 'other';
export type InKindDisposition = 'in_stock' | 'sold' | 'used' | 'returned';

export interface InKindSummary {
  id: string;
  donorName: string;
  devoteeId: string | null;
  category: InKindCategory;
  item: string;
  quantity: string | null;
  unit: string | null;
  estimatedValue: string | null;
  currency: 'INR' | 'BDT';
  receivedOn: string;
  disposition: InKindDisposition;
  disposalNote: string | null;
  note: string | null;
}

export interface InKindStats {
  currency: 'INR' | 'BDT';
  /** Count of offerings still held. */
  inStockCount: number;
  /** Total indicative value of offerings still held. */
  inStockValue: string;
}
