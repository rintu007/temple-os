export interface ReconcileEntry {
  kind: 'receipt' | 'payment' | 'transfer_in' | 'transfer_out';
  id: string;
  /** Receipt number, voucher number, or "Transfer" for a transfer. */
  ref: string;
  party: string;
  amount: string;
  at: Date;
  cleared: boolean;
}

export interface ReconciliationRecord {
  statementDate: string;
  statementBalance: string;
  clearedBalance: string;
  difference: string;
  createdAt: Date;
}

export interface ReconciliationView {
  accountId: string;
  accountName: string;
  currency: 'INR' | 'BDT';
  openingBalance: string;
  /** opening + all recorded receipts − all recorded payments. */
  bookBalance: string;
  /** opening + cleared receipts − cleared payments. */
  clearedBalance: string;
  unclearedReceipts: string;
  unclearedPayments: string;
  entries: ReconcileEntry[];
  lastReconciliation: ReconciliationRecord | null;
}
