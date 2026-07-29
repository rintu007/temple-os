import type { PlatformPlan } from '@templeos/validators';

export type PlatformSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export interface BillingStatus {
  plan: PlatformPlan;
  status: PlatformSubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  hasStripeCustomer: boolean;
  isTrialExpired: boolean;
}
