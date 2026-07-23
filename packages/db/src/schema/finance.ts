import {
  date,
  index,
  integer,
  jsonb,
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

export const campaignStatusEnum = pgEnum('campaign_status', ['active', 'completed', 'archived']);

/**
 * A fundraising campaign with a monetary goal (renovation, festival fund).
 * Progress is derived — the sum of recorded donations earmarked to it — so
 * there is no denormalized total to drift out of sync.
 */
export const campaigns = pgTable(
  'campaigns',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    title: text().notNull(),
    description: text(),
    goalAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    status: campaignStatusEnum().notNull().default('active'),
    ...timestamps,
  },
  (t) => [index('campaigns_org_status_idx').on(t.organizationId, t.status)],
);

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
 * 'online' rows are created by the payment confirmation flow only. Money is
 * numeric(12,2) + currency — never floats.
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
    campaignId: uuid().references(() => campaigns.id),
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

export const expenseMethodEnum = pgEnum('expense_method', [
  'cash',
  'upi',
  'bank_transfer',
  'card',
  'cheque',
  'other',
]);
export const expenseStatusEnum = pgEnum('expense_status', ['recorded', 'void']);

export const expenseCategories = pgTable(
  'expense_categories',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    name: text().notNull(),
    ...timestamps,
  },
  (t) => [index('expense_categories_org_name_idx').on(t.organizationId, t.name)],
);

/** Per-organization sequential voucher numbering — separate series from receipts. */
export const expenseCounters = pgTable('expense_counters', {
  organizationId: uuid()
    .primaryKey()
    .references(() => organizations.id),
  nextNumber: integer().notNull().default(1),
});

/**
 * An expense voucher — the outgoing side of the temple's books. Same ledger
 * discipline as donations: sequentially numbered, never deleted, only voided.
 */
export const expenses = pgTable(
  'expenses',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    categoryId: uuid().references(() => expenseCategories.id),
    paidTo: text().notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    method: expenseMethodEnum().notNull(),
    reference: text(),
    note: text(),
    voucherNumber: text().notNull(),
    spentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    recordedByUserId: uuid(),
    status: expenseStatusEnum().notNull().default('recorded'),
    voidReason: text(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('expenses_org_voucher_uq').on(t.organizationId, t.voucherNumber),
    index('expenses_org_date_idx').on(t.organizationId, t.spentAt),
  ],
);

export const paymentOrderStatusEnum = pgEnum('payment_order_status', [
  'created',
  'paid',
  'failed',
]);

/**
 * Tracks a checkout in progress with a payment provider (Razorpay today).
 * Created before the donor pays; confirmed atomically into a `donations` row
 * once the signature is verified. providerOrderId is globally unique per
 * provider, which also makes confirmation naturally idempotent.
 */
export const paymentOrders = pgTable(
  'payment_orders',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    provider: text().notNull().default('razorpay'),
    providerOrderId: text().notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    donorName: text().notNull(),
    email: text(),
    phone: text(),
    categoryName: text(),
    campaignId: uuid().references(() => campaigns.id),
    status: paymentOrderStatusEnum().notNull().default('created'),
    donationId: uuid().references(() => donations.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('payment_orders_provider_order_uq').on(t.provider, t.providerOrderId),
    index('payment_orders_org_idx').on(t.organizationId),
  ],
);

/**
 * A single counting of a temple offering box (hundi / pranami / donation box).
 * The money is real donation income, so every collection also creates a
 * `donations` row (method 'cash', category "Hundi") via the shared receipt
 * sequence — that's what feeds the ledger, reports and overview. This table
 * keeps the box-specific detail: which box, when counted, and the optional
 * denomination breakdown that was tallied to reach the total.
 */
export const hundiCollections = pgTable(
  'hundi_collections',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    boxName: text().notNull(),
    countedOn: date().notNull(),
    /** Array of { value, count } tallied — null when only a total was entered. */
    denominations: jsonb().$type<{ value: number; count: number }[]>(),
    totalAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    note: text(),
    /** The ledger entry this counting produced. */
    donationId: uuid()
      .notNull()
      .references(() => donations.id),
    countedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('hundi_collections_org_date_idx').on(t.organizationId, t.countedOn)],
);
