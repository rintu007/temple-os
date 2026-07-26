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
  /** openingBalance + received − paid. Can be negative (overdrawn). */
  balance: string;
}

export interface AccountMovement {
  id: string;
  kind: 'receipt' | 'payment';
  /** Receipt number (receipt) or voucher number (payment). */
  ref: string;
  /** Donor (receipt) or payee (payment). */
  party: string;
  amount: string;
  at: Date;
  /** Running account balance after this movement. */
  balance: string;
}

export interface AccountPassbook {
  account: AccountSummary;
  currency: 'INR' | 'BDT';
  movements: AccountMovement[];
}

export interface AccountStats {
  currency: 'INR' | 'BDT';
  totalBalance: string;
  activeCount: number;
}
