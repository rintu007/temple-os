import type { PlatformPlan } from '@templeos/validators';
import type { PlatformSubscriptionStatus } from '../billing/billing.types';

export interface PlatformOrgSummary {
  id: string;
  name: string;
  slug: string;
  country: string;
  orgStatus: string;
  createdAt: Date;
  /** Null means no subscription row — a legacy org provisioned before M61. */
  plan: PlatformPlan | null;
  subscriptionStatus: PlatformSubscriptionStatus | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  isTrialExpired: boolean;
  mrrUsd: number;
}

export interface PlatformOverview {
  organizations: PlatformOrgSummary[];
  totalOrganizations: number;
  totalMrrUsd: number;
  activeSubscriptions: number;
  trialing: number;
}
