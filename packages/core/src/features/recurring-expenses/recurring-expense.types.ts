export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type RecurringStatus = 'active' | 'paused' | 'ended';

export interface RecurringExpenseSummary {
  id: string;
  payee: string;
  description: string | null;
  category: string | null;
  amount: string;
  frequency: RecurringFrequency;
  accountId: string | null;
  accountName: string | null;
  startDate: string;
  endDate: string | null;
  status: RecurringStatus;
  /** Derived — total paid via the expense ledger against this standing order. */
  paidTotal: string;
  /** Derived — most recent payment date, or null if never paid. */
  lastPaidAt: Date | null;
  /** Computed — next due date on/after today, or null once ended/paused. */
  nextDue: string | null;
}

export interface RecurringExpensePayment {
  id: string;
  voucherNumber: string;
  amount: string;
  at: Date;
}

export interface RecurringExpenseDetail {
  recurring: RecurringExpenseSummary;
  currency: 'INR' | 'BDT';
  payments: RecurringExpensePayment[];
}

export interface RecurringExpenseStats {
  currency: 'INR' | 'BDT';
  activeCount: number;
  /** Sum of active standing orders normalised to a monthly figure. */
  monthlyEquivalent: string;
}
