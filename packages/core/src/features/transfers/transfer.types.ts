export interface TransferSummary {
  id: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: string;
  transferredOn: string;
  reference: string | null;
  note: string | null;
}

export interface TransferStats {
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  /** Number of transfers recorded. */
  count: number;
  /** Total value moved across all transfers (gross). */
  total: string;
}
