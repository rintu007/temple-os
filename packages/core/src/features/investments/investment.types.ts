export type InvestmentType =
  | 'fixed_deposit'
  | 'recurring_deposit'
  | 'bond'
  | 'mutual_fund'
  | 'other';
export type InvestmentStatus = 'active' | 'matured' | 'closed';

export interface InvestmentSummary {
  id: string;
  institution: string;
  type: InvestmentType;
  fundId: string | null;
  /** Name of the linked fund, when this holding belongs to one. */
  fundName: string | null;
  reference: string | null;
  status: InvestmentStatus;
  investedOn: string;
  maturityDate: string | null;
  /** Annual interest rate %, informational — null if not recorded. */
  interestRate: string | null;
  principal: string;
  /** Value at maturity as printed on the receipt — null if not stated. */
  maturityValue: string | null;
  /** Derived — maturityValue − principal, when a maturity value is recorded. */
  interestEarned: string | null;
}

export interface InvestmentStats {
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  /** Principal across active holdings — the corpus currently parked. */
  totalInvested: string;
  /** Sum of active maturity values (falls back to principal when not stated). */
  totalMaturityValue: string;
  /** totalMaturityValue − totalInvested; expected interest still to accrue. */
  expectedInterest: string;
  activeCount: number;
}
