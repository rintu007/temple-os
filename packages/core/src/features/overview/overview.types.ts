export type Currency = 'INR' | 'BDT';

export interface TrendPoint {
  /** 'YYYY-MM' */
  month: string;
  /** Short month label, e.g. 'Jul'. */
  label: string;
  donations: string;
  expenses: string;
}

export interface OverviewCampaign {
  id: string;
  title: string;
  goalAmount: string;
  raisedAmount: string;
  donationCount: number;
}

export type UpcomingKind = 'event' | 'puja' | 'facility';

export interface UpcomingItem {
  kind: UpcomingKind;
  /** ISO date ('YYYY-MM-DD') the item falls on — for sorting and display. */
  date: string;
  /** Optional 'HH:MM' when known (pujas/events). */
  time: string | null;
  title: string;
  subtitle: string | null;
}

export interface AttentionCounts {
  requestedFacilityBookings: number;
  pendingPujaBookings: number;
  openVolunteerOpportunities: number;
  membershipsDueRenewal: number;
}

export interface ActivityItem {
  action: string;
  entityType: string;
  createdAt: Date;
}

export interface Overview {
  currency: Currency;
  donations: { monthTotal: string; monthCount: number; allTimeTotal: string };
  expenses: { monthTotal: string; monthCount: number };
  /** Donations minus expenses for the current month. */
  netThisMonth: string;
  trend: TrendPoint[];
  campaigns: OverviewCampaign[];
  schedule: UpcomingItem[];
  attention: AttentionCounts;
  activity: ActivityItem[];
}
