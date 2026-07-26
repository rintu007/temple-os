import {
  boolean,
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
    /** Set when this donation fulfils (part of) a pledge — see `pledges`. */
    pledgeId: uuid().references(() => pledges.id),
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
    index('donations_pledge_idx').on(t.pledgeId),
  ],
);

/** 'open' pledges are outstanding; 'cancelled' retires a pledge not being pursued. */
export const pledgeStatusEnum = pgEnum('pledge_status', ['open', 'cancelled']);

/**
 * A promise to donate — made at a pledge drive, a fundraising appeal, or toward
 * a campaign. The pledged amount is fixed here; how much has been *received* is
 * derived from the recorded donations that link back via `donations.pledgeId`,
 * so a pledge's outstanding balance never drifts from the receipt book (same
 * discipline as vendor bills and campaign progress).
 */
export const pledges = pgTable(
  'pledges',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    devoteeId: uuid().references(() => devotees.id),
    campaignId: uuid().references(() => campaigns.id),
    donorName: text().notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    pledgedOn: date().notNull(),
    dueDate: date(),
    note: text(),
    status: pledgeStatusEnum().notNull().default('open'),
    cancelReason: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [
    index('pledges_org_status_idx').on(t.organizationId, t.status),
    index('pledges_devotee_idx').on(t.devoteeId),
    index('pledges_org_due_idx').on(t.organizationId, t.dueDate),
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

/**
 * Sign-off state, independent of the ledger `status`. 'not_required' when the
 * org has no threshold or the amount is below it; otherwise 'pending' until a
 * manager approves or rejects. Rejection is a governance flag — the voucher
 * still exists (money may already have gone out), so financial totals are
 * unaffected by this field.
 */
export const expenseApprovalStatusEnum = pgEnum('expense_approval_status', [
  'not_required',
  'pending',
  'approved',
  'rejected',
]);

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
    /** Optional links to the payables ledger — set when a voucher settles a vendor bill. */
    vendorId: uuid().references(() => vendors.id),
    vendorBillId: uuid().references(() => vendorBills.id),
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
    approvalStatus: expenseApprovalStatusEnum().notNull().default('not_required'),
    approvedByUserId: uuid(),
    decidedAt: timestamp({ withTimezone: true }),
    rejectionReason: text(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('expenses_org_voucher_uq').on(t.organizationId, t.voucherNumber),
    index('expenses_org_date_idx').on(t.organizationId, t.spentAt),
    index('expenses_vendor_bill_idx').on(t.vendorBillId),
    index('expenses_org_approval_idx').on(t.organizationId, t.approvalStatus),
  ],
);

/**
 * A vendor / supplier the temple pays — priests' provisioners, electricians,
 * caterers, printers. The payee master behind the expense ledger's free-text
 * `paidTo`, and the anchor for the accounts-payable (bills) sub-ledger.
 */
export const vendors = pgTable(
  'vendors',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    name: text().notNull(),
    category: text(),
    contactPerson: text(),
    phone: text(),
    email: text(),
    address: text(),
    /** GSTIN (IN) / BIN (BD) or any tax registration reference. */
    taxId: text(),
    note: text(),
    isActive: boolean().notNull().default(true),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('vendors_org_active_idx').on(t.organizationId, t.isActive)],
);

/** 'open' bills are payable; 'void' cancels a bill entered in error. */
export const vendorBillStatusEnum = pgEnum('vendor_bill_status', ['open', 'void']);

/**
 * A bill / invoice raised by a vendor. The amount owed is fixed here; how much
 * has been *paid* is derived — the sum of recorded expense vouchers linked back
 * via `expenses.vendorBillId` — so outstanding balances never drift out of sync
 * with the books (same discipline as campaign progress).
 */
export const vendorBills = pgTable(
  'vendor_bills',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    vendorId: uuid()
      .notNull()
      .references(() => vendors.id),
    templeId: uuid().references(() => temples.id),
    /** The vendor's own invoice number, as printed on their document. */
    billNumber: text().notNull(),
    description: text(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    billDate: date().notNull(),
    dueDate: date(),
    note: text(),
    status: vendorBillStatusEnum().notNull().default('open'),
    voidReason: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [
    index('vendor_bills_org_status_idx').on(t.organizationId, t.status),
    index('vendor_bills_vendor_idx').on(t.vendorId),
    index('vendor_bills_org_due_idx').on(t.organizationId, t.dueDate),
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
