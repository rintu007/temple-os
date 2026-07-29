export interface GrantSummary {
  id: string;
  funder: string;
  title: string;
  reference: string | null;
  sanctionedOn: string | null;
  purpose: string | null;
  status: 'active' | 'closed';
  sanctionedAmount: string;
  /** Derived — recorded donations tagged to this grant (money released). */
  received: string;
  /** Derived — recorded expenses tagged to this grant (money spent). */
  utilized: string;
  /** received − utilized; the unspent grant balance in hand. */
  unspent: string;
  /** sanctionedAmount − received; grant sanctioned but not yet released. */
  pendingRelease: string;
}

export interface GrantLedgerEntry {
  id: string;
  /** Receipt number (receipt) or voucher number (utilization). */
  ref: string;
  /** Donor/source (receipt) or payee (utilization). */
  party: string;
  amount: string;
  at: Date;
}

export interface GrantDetail {
  grant: GrantSummary;
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  receipts: GrantLedgerEntry[];
  utilizations: GrantLedgerEntry[];
}

export interface GrantStats {
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  activeCount: number;
  /** Total unspent across active grants — money that must still be utilized. */
  totalUnspent: string;
}
