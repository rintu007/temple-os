export type AssetCategory =
  | 'jewelry'
  | 'vessels'
  | 'idols'
  | 'land'
  | 'building'
  | 'vehicle'
  | 'furniture'
  | 'electronics'
  | 'other';

export type AssetStatus = 'active' | 'disposed';

export interface AssetSummary {
  id: string;
  name: string;
  category: AssetCategory;
  description: string | null;
  quantity: number;
  estimatedValue: string | null;
  currency: 'INR' | 'BDT';
  acquiredOn: string | null;
  location: string | null;
  status: AssetStatus;
  disposalReason: string | null;
  note: string | null;
  createdAt: Date;
}

export interface AssetStats {
  currency: 'INR' | 'BDT';
  activeCount: number;
  /** Sum of estimatedValue × quantity across active assets. */
  activeValue: string;
}
