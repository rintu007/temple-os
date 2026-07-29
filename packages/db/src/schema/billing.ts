import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './helpers';
import { organizations } from './tenancy';

export const platformPlanEnum = pgEnum('platform_plan', ['trial', 'starter', 'growth', 'pro']);
export const platformSubscriptionStatusEnum = pgEnum('platform_subscription_status', [
  'trialing',
  'active',
  'past_due',
  'canceled',
]);

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
  plan: platformPlanEnum().notNull().default('trial'),
  status: platformSubscriptionStatusEnum().notNull().default('trialing'),
  stripeCustomerId: text(),
  stripeSubscriptionId: text(),
  trialEndsAt: timestamp({ withTimezone: true }),
  /** End of the current paid billing period — null while on trial. */
  currentPeriodEnd: timestamp({ withTimezone: true }),
  ...timestamps,
});
