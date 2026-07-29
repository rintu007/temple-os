export type SevaFrequency = 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type SevaStatus = 'active' | 'paused' | 'ended';

export interface SevaSummary {
  id: string;
  sponsorName: string;
  devoteeId: string | null;
  sevaName: string;
  amount: string;
  frequency: SevaFrequency;
  occasion: string | null;
  startDate: string;
  endDate: string | null;
  status: SevaStatus;
  /** Derived — recorded donations tagged to this seva. */
  collected: string;
  /** Derived — most recent payment date, if any. */
  lastPaidAt: Date | null;
  /** Computed — the next occurrence date on/after today, null once ended. */
  nextOccurrence: string | null;
}

export interface SevaPayment {
  id: string;
  receiptNumber: string;
  amount: string;
  at: Date;
}

export interface SevaDetail {
  seva: SevaSummary;
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  payments: SevaPayment[];
}

export interface SevaStats {
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  activeCount: number;
  /** Sum of one occurrence across all active sevas — the recurring run-rate. */
  perCycleValue: string;
}
