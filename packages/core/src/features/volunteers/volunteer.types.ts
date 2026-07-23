export interface OpportunitySummary {
  id: string;
  title: string;
  description: string | null;
  servingOn: string | null;
  slotsNeeded: number;
  signupCount: number;
  status: 'open' | 'closed';
  createdAt: Date;
}

export interface SignupSummary {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  createdAt: Date;
}

/** Public-site card — open opportunities only. */
export interface PublicOpportunity {
  id: string;
  title: string;
  description: string | null;
  servingOn: string | null;
  slotsNeeded: number;
  signupCount: number;
  /** True when slotsNeeded > 0 and filled. */
  full: boolean;
}
