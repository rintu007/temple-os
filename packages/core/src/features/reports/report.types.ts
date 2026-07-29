export interface ReportBucket {
  /** Category name or payment method key. */
  label: string;
  total: string;
  count: number;
}

export interface DonationReport {
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  from: string | null;
  to: string | null;
  /** Recorded (non-void) donations only. */
  total: string;
  count: number;
  voidCount: number;
  byCategory: ReportBucket[];
  byMethod: ReportBucket[];
}
