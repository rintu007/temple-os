export type PlatformPlan = 'trial' | 'pro';

export interface PlanCatalogEntry {
  key: PlatformPlan;
  name: string;
  /** USD per month; null for the trial, which is never purchased directly. */
  priceUsd: number | null;
  description: string;
  features: readonly string[];
}

/** TempleOS bills every org in USD regardless of the org's own donor-facing currency. */
export const PLAN_CATALOG: Record<PlatformPlan, PlanCatalogEntry> = {
  trial: {
    key: 'trial',
    name: 'Trial',
    priceUsd: null,
    description: '14-day full-feature trial — no card required.',
    features: ['Every module unlocked', 'Up to 2 staff accounts'],
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    priceUsd: 29,
    description: 'Everything TempleOS offers, for one temple, billed monthly.',
    features: ['Every module unlocked', 'Unlimited staff accounts', 'Priority support'],
  },
};

export const TRIAL_LENGTH_DAYS = 14;
