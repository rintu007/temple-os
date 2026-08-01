import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './helpers';
import { organizations } from './tenancy';

export const platformSubscriptionStatusEnum = pgEnum('platform_subscription_status', [
  'trialing',
  'active',
  'past_due',
  'canceled',
]);

/**
 * Platform-admin-editable package catalog — replaces a formerly-hardcoded
 * TypeScript constant so plan pricing, feature copy, and module entitlements
 * can change without a deploy. `key` is a free-form slug (not a fixed union
 * in TypeScript anymore): platform staff can add, rename, or retire tiers
 * from /platform/plans. Exactly one row should have `isTrialDefault` (the
 * plan new orgs are provisioned onto) and exactly one `isFallbackDefault`
 * (what a lapsed/expired org's entitlement falls back to) — enforced in
 * packages/core/src/features/plans, not by a DB constraint, since "exactly
 * one" isn't expressible as a simple column check.
 */
export const planCatalog = pgTable('plan_catalog', {
  key: text().primaryKey(),
  name: text().notNull(),
  /** USD per month; null for tiers that are never purchased directly (trial). */
  priceUsd: integer(),
  description: text().notNull(),
  /** Marketing bullet points, in display order. */
  features: jsonb().$type<string[]>().notNull().default([]),
  /** Gateable module keys this plan unlocks — see packages/validators/src/billing.ts#ModuleKey. */
  modules: jsonb().$type<string[]>().notNull().default([]),
  isPurchasable: boolean().notNull().default(false),
  /** Stripe Price id for a monthly subscription to this plan — set once the plan goes live in Stripe. */
  stripePriceId: text(),
  isTrialDefault: boolean().notNull().default(false),
  isFallbackDefault: boolean().notNull().default(false),
  sortOrder: integer().notNull().default(0),
  ...timestamps,
});

/**
 * TempleOS's own SaaS subscription for a tenant — not to be confused with
 * `payment_orders` (devotee donations to the temple). One row per org,
 * seeded at provisioning with a trial. Stripe is the billing engine; the
 * Stripe ids are null until the org completes checkout at least once.
 */
export const platformSubscriptions = pgTable('platform_subscriptions', {
  organizationId: uuid()
    .primaryKey()
    .references(() => organizations.id),
  plan: text()
    .notNull()
    .references(() => planCatalog.key),
  status: platformSubscriptionStatusEnum().notNull().default('trialing'),
  stripeCustomerId: text(),
  stripeSubscriptionId: text(),
  trialEndsAt: timestamp({ withTimezone: true }),
  /** End of the current paid billing period — null while on trial. */
  currentPeriodEnd: timestamp({ withTimezone: true }),
  ...timestamps,
});
