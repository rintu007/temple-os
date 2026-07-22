export interface MembershipPlanSummary {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: 'INR' | 'BDT';
  durationMonths: number;
  isActive: boolean;
}

/** Public plan shown on the tenant site. */
export interface PublicMembershipPlan {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: 'INR' | 'BDT';
  durationMonths: number;
}

/** Roster row. 'expired' is derived: an active row whose expiresOn is past. */
export interface SubscriptionSummary {
  id: string;
  planName: string;
  memberName: string;
  email: string | null;
  phone: string | null;
  amount: string;
  currency: 'INR' | 'BDT';
  startsOn: string | null;
  expiresOn: string | null;
  status: 'pending' | 'active' | 'cancelled';
  isExpired: boolean;
  createdAt: Date;
}

export interface SubscriptionPage {
  items: SubscriptionSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface JoinOrder {
  orderId: string;
  amountPaise: number;
  currency: 'INR';
  keyId: string;
  planName: string;
}

export interface ConfirmedJoin {
  receiptNumber: string;
  planName: string;
  memberName: string;
  amount: string;
  currency: 'INR' | 'BDT';
  expiresOn: string | null;
  /** True when another path (client confirm or webhook) already recorded it. */
  alreadyPaid: boolean;
}
