export interface FundSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  /** Derived — recorded donations earmarked to this fund. */
  income: string;
  /** Derived — recorded expenses drawn from this fund. */
  expense: string;
  /** income − expense; can be negative if a fund is overdrawn. */
  balance: string;
}

export interface FundLedgerEntry {
  id: string;
  /** Receipt number (income) or voucher number (expense). */
  ref: string;
  /** Donor (income) or payee (expense). */
  party: string;
  amount: string;
  at: Date;
}

export interface FundDetail {
  fund: FundSummary;
  income: FundLedgerEntry[];
  expenditure: FundLedgerEntry[];
}

export interface FundStats {
  currency: 'INR' | 'BDT';
  totalBalance: string;
  activeCount: number;
}
