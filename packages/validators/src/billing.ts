export const PLATFORM_PLANS = ['trial', 'starter', 'growth', 'pro'] as const;
export type PlatformPlan = (typeof PLATFORM_PLANS)[number];

export interface PlanCatalogEntry {
  key: PlatformPlan;
  name: string;
  /** USD per month; null for tiers that are never purchased directly (trial, free Starter). */
  priceUsd: number | null;
  description: string;
  features: readonly string[];
}

/**
 * Gateable feature bundles — every module not listed here (dashboard, insights,
 * temples & schedules, devotees, one-time donations, events, team, activity,
 * website, billing) is "core" and included on every plan, even Starter. A
 * temple's public site and its ability to receive donations must never
 * depend on TempleOS's own subscription status.
 */
export type ModuleKey = 'worship' | 'community' | 'finance-basic' | 'accounting';

export const MODULE_NAMES: Record<ModuleKey, string> = {
  worship: 'Worship (puja booking, sevas, prasadam, darshan, facilities)',
  community: 'Community (membership, volunteers, officers, communications, meetings)',
  'finance-basic': 'Fundraising (campaigns, pledges, hundi, in-kind, expenses, recurring)',
  accounting: 'Full accounting (accounts, payroll, budgets, statements, inventory, 80G tax)',
};

/** TempleOS bills every org in USD regardless of the org's own donor-facing currency. */
export const PLAN_CATALOG: Record<PlatformPlan, PlanCatalogEntry> = {
  trial: {
    key: 'trial',
    name: 'Trial',
    priceUsd: null,
    description: '14-day full-feature trial — no card required.',
    features: ['Every module unlocked', 'Up to 2 staff accounts'],
  },
  starter: {
    key: 'starter',
    name: 'Starter',
    priceUsd: 0,
    description: 'Core temple operations, free forever — what a trial falls back to.',
    features: ['Devotees, donations, events, public website', 'Up to 2 staff accounts'],
  },
  growth: {
    key: 'growth',
    name: 'Growth',
    priceUsd: 29,
    description: 'Starter plus worship bookings, community tools, and fundraising.',
    features: [
      'Everything in Starter',
      'Puja booking, sevas, prasadam, darshan, facilities',
      'Membership, volunteers, officers, communications',
      'Campaigns, pledges, hundi, in-kind, recurring donations',
      'Unlimited staff accounts',
    ],
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    priceUsd: 79,
    description: 'Everything TempleOS offers, including full fund accounting.',
    features: [
      'Everything in Growth',
      'Accounts, payroll, budgets, statements, reconciliation',
      'Inventory, assets, vendors, loans, investments, grants',
      '80G/tax receipts, annual report, custom roles',
      'Priority support',
    ],
  },
};

/** Paid tiers a Stripe Checkout session can actually be started for. */
export const PURCHASABLE_PLANS: readonly PlatformPlan[] = ['growth', 'pro'];

/** Which gateable modules each plan includes. Starter has none — core only. */
export const PLAN_MODULES: Record<PlatformPlan, readonly ModuleKey[]> = {
  trial: ['worship', 'community', 'finance-basic', 'accounting'],
  starter: [],
  growth: ['worship', 'community', 'finance-basic'],
  pro: ['worship', 'community', 'finance-basic', 'accounting'],
};

export const TRIAL_LENGTH_DAYS = 14;
