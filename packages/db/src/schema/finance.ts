import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { devotees } from './community';
import { currencyEnum, organizations, temples } from './tenancy';

export const donationMethodEnum = pgEnum('donation_method', [
  'cash',
  'upi',
  'bank_transfer',
  'card',
  'online',
  'other',
]);
export const donationStatusEnum = pgEnum('donation_status', ['recorded', 'void']);

export const donationCategories = pgTable(
  'donation_categories',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    name: text().notNull(),
    ...timestamps,
  },
  (t) => [index('donation_categories_org_name_idx').on(t.organizationId, t.name)],
);

/** Per-organization sequential receipt numbering. */
export const donationCounters = pgTable('donation_counters', {
  organizationId: uuid()
    .primaryKey()
    .references(() => organizations.id),
  nextNumber: integer().notNull().default(1),
});

/**
 * A donation record. Manual methods (cash/upi/bank) are recorded by staff;
 * 'online' rows will be created by the payment webhook (Phase 1 checkout).
 * Money is numeric(12,2) + currency — never floats.
 */
export const donations = pgTable(
  'donations',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    devoteeId: uuid().references(() => devotees.id),
    categoryId: uuid().references(() => donationCategories.id),
    donorName: text().notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    method: donationMethodEnum().notNull(),
    reference: text(),
    note: text(),
    receiptNumber: text().notNull(),
    donatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    recordedByUserId: uuid(),
    status: donationStatusEnum().notNull().default('recorded'),
    voidReason: text(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('donations_org_receipt_uq').on(t.organizationId, t.receiptNumber),
    index('donations_org_date_idx').on(t.organizationId, t.donatedAt),
    index('donations_devotee_idx').on(t.devoteeId),
  ],
);
