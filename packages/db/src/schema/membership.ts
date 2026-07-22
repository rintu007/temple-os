import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, softDelete, timestamps } from './helpers';
import { devotees } from './community';
import { currencyEnum, organizations } from './tenancy';

/** Priced membership tiers a temple offers (e.g. Annual Member, Life Patron). */
export const membershipPlans = pgTable(
  'membership_plans',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    name: text().notNull(),
    description: text(),
    price: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    durationMonths: integer().notNull(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index('membership_plans_org_idx').on(t.organizationId)],
);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'pending',
  'active',
  'cancelled',
]);

/**
 * A devotee's membership. Created 'pending' at checkout; 'active' once
 * payment is verified (a donation row is recorded for income/receipt).
 * "Expired" is derived, not stored: status='active' AND expires_on < today.
 * planName is snapshotted so history survives plan edits.
 */
export const membershipSubscriptions = pgTable(
  'membership_subscriptions',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    planId: uuid().references(() => membershipPlans.id),
    planName: text().notNull(),
    devoteeId: uuid().references(() => devotees.id),
    memberName: text().notNull(),
    email: text(),
    phone: text(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    startsOn: date(),
    expiresOn: date(),
    status: subscriptionStatusEnum().notNull().default('pending'),
    provider: text(),
    providerOrderId: text(),
    providerPaymentId: text(),
    ...timestamps,
  },
  (t) => [
    index('membership_subs_org_status_idx').on(t.organizationId, t.status),
    uniqueIndex('membership_subs_provider_order_uq').on(t.providerOrderId),
  ],
);
