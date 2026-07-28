export type RecurringDonationFrequency = 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type RecurringDonationStatus = 'active' | 'paused' | 'ended';

export interface RecurringDonationSummary {
  id: string;
  donorName: string;
  devoteeId: string | null;
  amount: string;
  frequency: RecurringDonationFrequency;
  fundId: string | null;
  fundName: string | null;
  startDate: string;
  endDate: string | null;
  status: RecurringDonationStatus;
  /** Derived — total received via the donation ledger against this standing gift. */
  givenTotal: string;
  /** Derived — most recent receipt date, or null if never given. */
  lastGivenAt: Date | null;
  /** Computed — next due date on/after today, or null once ended/paused. */
  nextDue: string | null;
}

export interface RecurringDonationPayment {
  id: string;
  receiptNumber: string;
  amount: string;
  at: Date;
}

export interface RecurringDonationDetail {
  recurring: RecurringDonationSummary;
  currency: 'INR' | 'BDT';
  payments: RecurringDonationPayment[];
}

export interface RecurringDonationStats {
  currency: 'INR' | 'BDT';
  activeCount: number;
  /** Sum of active standing gifts normalised to a monthly figure. */
  monthlyEquivalent: string;
}
