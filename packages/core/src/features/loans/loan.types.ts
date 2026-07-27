export type LoanDirection = 'given' | 'taken';
export type LoanStatus = 'active' | 'closed' | 'written_off';

export interface LoanSummary {
  id: string;
  direction: LoanDirection;
  counterparty: string;
  employeeId: string | null;
  /** Name of the linked staff member, when this is a staff advance. */
  employeeName: string | null;
  title: string | null;
  status: LoanStatus;
  disbursedOn: string;
  dueOn: string | null;
  /** Annual interest rate %, informational — null for interest-free. */
  interestRate: string | null;
  principal: string;
  /** Derived — sum of recorded repayments against this loan. */
  repaid: string;
  /** principal − repaid; what is still owed. Never below zero. */
  outstanding: string;
}

export interface LoanRepaymentEntry {
  id: string;
  amount: string;
  paidOn: string;
  note: string | null;
}

export interface LoanDetail {
  loan: LoanSummary;
  currency: 'INR' | 'BDT';
  repayments: LoanRepaymentEntry[];
}

export interface LoanStats {
  currency: 'INR' | 'BDT';
  /** Outstanding across active loans the temple gave out (money owed to it). */
  receivable: string;
  /** Outstanding across active loans the temple took (money it owes). */
  payable: string;
  activeCount: number;
}
