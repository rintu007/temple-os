export interface CampaignSummary {
  id: string;
  title: string;
  description: string | null;
  goalAmount: string;
  raisedAmount: string;
  donationCount: number;
  currency: 'INR' | 'BDT';
  status: 'active' | 'completed' | 'archived';
  createdAt: Date;
}

/** Public-site card — only what devotees see. */
export interface PublicCampaign {
  id: string;
  title: string;
  description: string | null;
  goalAmount: string;
  raisedAmount: string;
  currency: 'INR' | 'BDT';
  /** Whole-percent progress, capped at 100 for the bar. */
  percent: number;
}
