export interface FundSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  /** Derived — recorded donations earmarked to this fund. */
  income: string;
  /** Derived — recorded expenses drawn from this fund. */
  expense: string;
  /** Derived — reallocations into this fund from other funds. */
  transfersIn: string;
  /** Derived — reallocations out of this fund to other funds. */
  transfersOut: string;
  /** income + transfersIn − expense − transfersOut; can be negative. */
  balance: string;
}

export interface FundLedgerEntry {
  id: string;
  kind: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  /** Receipt/voucher number, or "Transfer" for a reallocation. */
  ref: string;
  /** Donor / payee, or the counterparty fund for a transfer. */
  party: string;
  amount: string;
  at: Date;
}

export interface FundDetail {
  fund: FundSummary;
  income: FundLedgerEntry[];
  expenditure: FundLedgerEntry[];
  transfers: FundLedgerEntry[];
}

export interface FundStats {
  currency: 'INR' | 'BDT';
  totalBalance: string;
  activeCount: number;
}
