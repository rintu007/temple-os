import { z } from 'zod';

/**
 * A plan's key is a free-form slug now, not a fixed union — the catalog
 * (packages/db/src/schema/billing.ts#planCatalog) is platform-editable, so
 * TypeScript can't know every valid key at compile time. Validity against
 * the live catalog is checked at the service layer (a DB lookup), not here.
 */
export type PlatformPlan = string;

/**
 * Gateable feature bundles — every module not listed here (dashboard, insights,
 * temples & schedules, devotees, one-time donations, events, team, activity,
 * website, billing) is "core" and included on every plan, even Starter. A
 * temple's public site and its ability to receive donations must never
 * depend on TempleOS's own subscription status.
 */
export const MODULE_KEYS = ['worship', 'community', 'finance-basic', 'accounting'] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_NAMES: Record<ModuleKey, string> = {
  worship: 'Worship (puja booking, sevas, prasadam, darshan, facilities)',
  community: 'Community (membership, volunteers, officers, communications, meetings)',
  'finance-basic': 'Fundraising (campaigns, pledges, hundi, in-kind, expenses, recurring)',
  accounting: 'Full accounting (accounts, payroll, budgets, statements, inventory, 80G tax)',
};

export const TRIAL_LENGTH_DAYS = 14;

/** A platform-admin-editable plan — mirrors packages/db/src/schema/billing.ts#planCatalog. */
export interface PlanCatalogEntry {
  key: string;
  name: string;
  priceUsd: number | null;
  description: string;
  features: readonly string[];
  modules: readonly ModuleKey[];
  isPurchasable: boolean;
  /** Max active + pending-invited staff seats an org on this plan may have; null = unlimited. */
  seatLimit: number | null;
  stripePriceId: string | null;
  isTrialDefault: boolean;
  isFallbackDefault: boolean;
  sortOrder: number;
}

const planEntryFields = {
  name: z.string().trim().min(1, 'Enter a plan name').max(60),
  priceUsd: z.coerce.number().int().min(0).nullable(),
  description: z.string().trim().min(1, 'Enter a description').max(300),
  features: z.array(z.string().trim().min(1).max(200)).max(20),
  modules: z.array(z.enum(MODULE_KEYS)),
  isPurchasable: z.boolean(),
  seatLimit: z.coerce.number().int().min(1).nullable(),
  stripePriceId: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .transform((v) => v || null),
  isTrialDefault: z.boolean(),
  isFallbackDefault: z.boolean(),
  sortOrder: z.coerce.number().int(),
};

export const createPlanCatalogEntrySchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only')
    .min(2, 'Key must be at least 2 characters')
    .max(40),
  ...planEntryFields,
});
export type CreatePlanCatalogEntryInput = z.infer<typeof createPlanCatalogEntrySchema>;

/** Key is immutable after creation — it's referenced by platform_subscriptions.plan. */
export const updatePlanCatalogEntrySchema = z.object(planEntryFields);
export type UpdatePlanCatalogEntryInput = z.infer<typeof updatePlanCatalogEntrySchema>;
