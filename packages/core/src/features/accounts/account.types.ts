export interface AccountSummary {
  id: string;
  name: string;
  type: 'bank' | 'cash';
  bankName: string | null;
  /** Account number with all but the last four digits masked. */
  accountNumberMasked: string | null;
  isActive: boolean;
  /** Money already held when the account was opened in TempleOS. */
  openingBalance: string;
  /** Derived — recorded donations tagged to this account. */
  received: string;
  /** Derived — recorded expenses paid from this account. */
  paid: string;
  /** Derived — internal transfers into this account. */
  transfersIn: string;
  /** Derived — internal transfers out of this account. */
  transfersOut: string;
  /** openingBalance + received + transfersIn − paid − transfersOut. Can be negative. */
  balance: string;
}

export interface AccountMovement {
  id: string;
  kind: 'receipt' | 'payment' | 'transfer_in' | 'transfer_out';
  /** Receipt number (receipt), voucher number (payment) or "Transfer" for a transfer. */
  ref: string;
  /** Donor / payee, or the counterparty account for a transfer. */
  party: string;
  amount: string;
  at: Date;
  /** Running account balance after this movement. */
  balance: string;
}

export interface AccountPassbook {
  account: AccountSummary;
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  movements: AccountMovement[];
}

export interface AccountStats {
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  totalBalance: string;
  activeCount: number;
}
