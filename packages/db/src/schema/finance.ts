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

export const budgetKindEnum = pgEnum('budget_kind', ['income', 'expense']);

/**
 * A planned amount for one category, in one financial year, on one side of the
 * books. Actuals are never stored here — they're read live from the donation
 * and expense ledgers grouped by category, so the budget-vs-actual comparison
 * always reflects the current books. Category is matched by name to the ledger
 * category labels ('Uncategorized' included).
 */
export const budgets = pgTable(
  'budgets',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    /** Financial-year start year — 2026 means FY 2026–27 (April–March). */
    financialYear: integer().notNull(),
    kind: budgetKindEnum().notNull(),
    category: text().notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('budgets_org_fy_kind_cat_uq').on(
      t.organizationId,
      t.financialYear,
      t.kind,
      t.category,
    ),
    index('budgets_org_fy_idx').on(t.organizationId, t.financialYear),
  ],
);

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

/**
 * A named fund the temple keeps money in — corpus/endowment, building, annadanam,
 * general. Unlike a campaign (a time-bound goal), a fund is a perpetual bucket.
 * Its balance is derived: recorded donations earmarked to it, less recorded
 * expenses drawn from it (via `donations.fundId` / `expenses.fundId`), so it
 * never drifts from the ledger.
 */
export const funds = pgTable(
  'funds',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    name: text().notNull(),
    description: text(),
    isActive: boolean().notNull().default(true),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('funds_org_active_idx').on(t.organizationId, t.isActive)],
);

export const accountTypeEnum = pgEnum('account_type', ['bank', 'cash']);

/**
 * A bank account or cash box the temple actually holds money in. The current
 * balance is derived: opening balance, plus recorded donations tagged to the
 * account, less recorded expenses paid from it (via `donations.accountId` /
 * `expenses.accountId`) — so it never drifts from the ledger. Opening balance
 * captures money already held when the temple started using TempleOS.
 */
export const financialAccounts = pgTable(
  'financial_accounts',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    name: text().notNull(),
    type: accountTypeEnum().notNull().default('bank'),
    /** Bank name / branch — null for a cash box. */
    bankName: text(),
    /** Account number as entered; shown masked in the UI. */
    accountNumber: text(),
    openingBalance: numeric({ precision: 12, scale: 2 }).notNull().default('0'),
    openingDate: date(),
    note: text(),
    isActive: boolean().notNull().default(true),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('financial_accounts_org_active_idx').on(t.organizationId, t.isActive)],
);

/**
 * A snapshot of one completed bank reconciliation — the treasurer ticked off
 * ledger entries against the statement and recorded the statement balance for
 * the audit trail. The individual cleared flags live on `donations.clearedAt`
 * and `expenses.clearedAt`; this table is the point-in-time record.
 */
export const accountReconciliations = pgTable(
  'account_reconciliations',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    accountId: uuid()
      .notNull()
      .references(() => financialAccounts.id),
    statementDate: date().notNull(),
    /** Closing balance printed on the bank statement. */
    statementBalance: numeric({ precision: 12, scale: 2 }).notNull(),
    /** Cleared balance in the books at reconcile time. */
    clearedBalance: numeric({ precision: 12, scale: 2 }).notNull(),
    /** statementBalance − clearedBalance; zero when fully reconciled. */
    difference: numeric({ precision: 12, scale: 2 }).notNull(),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('account_reconciliations_account_idx').on(t.accountId, t.statementDate)],
);

/**
 * An internal money movement between two of the temple's own accounts — bank to
 * cash box, one bank to another, or funding a deposit. Neither income nor
 * expense (it nets to zero across the org), so it stays out of the donation and
 * expense ledgers, but it moves each account's balance. It shows on both
 * accounts' bank statements, so it carries a cleared flag per side
 * (`fromClearedAt` / `toClearedAt`) for reconciliation. Immutable once recorded
 * — a mistake is corrected with a reversing transfer, never a delete.
 */
export const accountTransfers = pgTable(
  'account_transfers',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    fromAccountId: uuid()
      .notNull()
      .references(() => financialAccounts.id),
    toAccountId: uuid()
      .notNull()
      .references(() => financialAccounts.id),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    transferredOn: date().notNull(),
    reference: text(),
    note: text(),
    /** Cleared against the source account's statement. */
    fromClearedAt: timestamp({ withTimezone: true }),
    /** Cleared against the destination account's statement. */
    toClearedAt: timestamp({ withTimezone: true }),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [
    index('account_transfers_org_date_idx').on(t.organizationId, t.transferredOn),
    index('account_transfers_from_idx').on(t.fromAccountId),
    index('account_transfers_to_idx').on(t.toAccountId),
  ],
);

export const grantStatusEnum = pgEnum('grant_status', ['active', 'closed']);

/**
 * An earmarked grant from a government department, endowment board, CSR funder
 * or trust. The sanctioned amount is fixed here; how much has been *received*
 * and *utilized* is derived from the ledger (donations/expenses tagged with
 * `grantId`), so the unspent balance for the utilization certificate never
 * drifts from the books — same discipline as campaigns and vendor bills.
 */
export const grants = pgTable(
  'grants',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    /** The awarding body — "HR&CE Dept", "XYZ Foundation (CSR)", a Devaswom board. */
    funder: text().notNull(),
    /** Scheme or grant title. */
    title: text().notNull(),
    /** Sanction letter / order number. */
    reference: text(),
    sanctionedAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    sanctionedOn: date(),
    /** What the grant must be spent on — printed on the utilization report. */
    purpose: text(),
    status: grantStatusEnum().notNull().default('active'),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('grants_org_status_idx').on(t.organizationId, t.status)],
);

export const sevaFrequencyEnum = pgEnum('seva_frequency', [
  'weekly',
  'monthly',
  'quarterly',
  'annual',
]);
export const sevaStatusEnum = pgEnum('seva_status', ['active', 'paused', 'ended']);

/**
 * A standing (recurring) worship sponsorship — daily archana, monthly
 * abhishekam, an annual nakshatra seva. Unlike a one-time puja booking, a seva
 * recurs on a cadence. How much has actually been *collected* is derived from
 * the donations tagged to it (`donations.sevaSubscriptionId`), so a sponsor's
 * giving history never drifts from the receipt book — same discipline as
 * pledges. Auto-charge of online sponsors layers on via the payment webhook.
 */
export const sevaSubscriptions = pgTable(
  'seva_subscriptions',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    devoteeId: uuid().references(() => devotees.id),
    sponsorName: text().notNull(),
    /** The seva being sponsored — "Daily Archana", "Monthly Abhishekam". */
    sevaName: text().notNull(),
    /** Amount per occurrence. */
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    frequency: sevaFrequencyEnum().notNull(),
    /** Nakshatra / tithi / occasion the seva is performed on, if any. */
    occasion: text(),
    startDate: date().notNull(),
    /** Null = open-ended (until paused/ended). */
    endDate: date(),
    status: sevaStatusEnum().notNull().default('active'),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [
    index('seva_subscriptions_org_status_idx').on(t.organizationId, t.status),
    index('seva_subscriptions_devotee_idx').on(t.devoteeId),
  ],
);

export const loanDirectionEnum = pgEnum('loan_direction', ['given', 'taken']);
export const loanStatusEnum = pgEnum('loan_status', ['active', 'closed', 'written_off']);

/**
 * A loan or advance — money the temple lent out (`given`: a staff salary
 * advance, a loan to an affiliated trust) or borrowed (`taken`: a bank loan, a
 * hand loan). Purely a receivable/payable register: the principal is fixed
 * here, and how much has been *repaid* is derived from the repayment
 * sub-ledger (`loan_repayments.loanId`), so outstanding never drifts. Kept out
 * of the income/expense statements — a loan is a balance-sheet item, not
 * income or expenditure — the same memorandum discipline as pledges.
 */
export const loans = pgTable(
  'loans',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    direction: loanDirectionEnum().notNull(),
    /** The other party — staff name, a bank, an affiliated trust, a person. */
    counterparty: text().notNull(),
    /** Set when this is a staff advance recovered from pay — see `employees`. */
    employeeId: uuid().references(() => employees.id),
    /** Purpose / description — "Festival advance", "Vehicle loan". */
    title: text(),
    principal: numeric({ precision: 14, scale: 2 }).notNull(),
    /** Annual interest rate %, informational only — null for interest-free. */
    interestRate: numeric({ precision: 6, scale: 3 }),
    disbursedOn: date().notNull(),
    dueOn: date(),
    status: loanStatusEnum().notNull().default('active'),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [
    index('loans_org_status_idx').on(t.organizationId, t.status),
    index('loans_employee_idx').on(t.employeeId),
    index('loans_org_due_idx').on(t.organizationId, t.dueOn),
  ],
);

/**
 * One repayment installment against a loan. The running outstanding balance is
 * derived by summing these against the loan's principal — never denormalized.
 */
export const loanRepayments = pgTable(
  'loan_repayments',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    loanId: uuid()
      .notNull()
      .references(() => loans.id),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    paidOn: date().notNull(),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('loan_repayments_loan_idx').on(t.loanId, t.paidOn)],
);

export const investmentTypeEnum = pgEnum('investment_type', [
  'fixed_deposit',
  'recurring_deposit',
  'bond',
  'mutual_fund',
  'other',
]);
export const investmentStatusEnum = pgEnum('investment_status', ['active', 'matured', 'closed']);

/**
 * A parked-money holding — a fixed/recurring deposit, government bond or mutual
 * fund the temple keeps its corpus/endowment in. A balance-sheet asset register
 * (sibling to `assets` for physical property): the principal and the maturity
 * value printed on the deposit receipt are fixed here; interest earned is
 * derived (maturityValue − principal) so it never drifts. Optionally linked to
 * the fund the money belongs to. Memorandum register — like loans, it does not
 * itself post to the cash ledger.
 */
export const investments = pgTable(
  'investments',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    /** The fund this holding belongs to — corpus/endowment/building. Optional. */
    fundId: uuid().references(() => funds.id),
    /** Bank / post office / fund house holding the money. */
    institution: text().notNull(),
    type: investmentTypeEnum().notNull().default('fixed_deposit'),
    /** FD receipt number / folio number, as printed. */
    reference: text(),
    principal: numeric({ precision: 14, scale: 2 }).notNull(),
    /** Annual interest rate %, informational. */
    interestRate: numeric({ precision: 6, scale: 3 }),
    investedOn: date().notNull(),
    maturityDate: date(),
    /** Value at maturity as printed on the receipt — null if not stated. */
    maturityValue: numeric({ precision: 14, scale: 2 }),
    status: investmentStatusEnum().notNull().default('active'),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [
    index('investments_org_status_idx').on(t.organizationId, t.status),
    index('investments_fund_idx').on(t.fundId),
    index('investments_org_maturity_idx').on(t.organizationId, t.maturityDate),
  ],
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
    /** Earmarks this donation to a fund — see `funds`. */
    fundId: uuid().references(() => funds.id),
    /** The bank/cash account this money went into — see `financialAccounts`. */
    accountId: uuid().references(() => financialAccounts.id),
    /** Set once this entry is reconciled against the bank statement (cleared). */
    clearedAt: timestamp({ withTimezone: true }),
    /** Set when this receipt is the release of a grant — see `grants`. */
    grantId: uuid().references(() => grants.id),
    /** Set when this receipt pays toward a recurring seva — see `sevaSubscriptions`. */
    sevaSubscriptionId: uuid().references(() => sevaSubscriptions.id),
    donorName: text().notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    method: donationMethodEnum().notNull(),
    reference: text(),
    note: text(),
    /** Donor PAN — captured for 80G tax receipts (India). Optional. */
    donorPan: text(),
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
    index('donations_fund_idx').on(t.fundId),
    index('donations_account_idx').on(t.accountId),
    index('donations_grant_idx').on(t.grantId),
    index('donations_seva_idx').on(t.sevaSubscriptionId),
  ],
);

/**
 * A tenant's tax-registration profile (India: section 80G). One row per org.
 * These details print on donation receipts so donors can claim deductions.
 * No money here — purely the registered-entity identity used on receipts.
 */
export const taxProfiles = pgTable('tax_profiles', {
  organizationId: uuid()
    .primaryKey()
    .references(() => organizations.id),
  /** Registered legal name of the trust/society (may differ from display name). */
  legalName: text().notNull(),
  /** Trust/society PAN. */
  pan: text(),
  /** 80G registration / approval number granted by the tax authority. */
  registrationNumber: text().notNull(),
  /** Validity window of the 80G approval, if the certificate states one. */
  validFrom: date(),
  validUntil: date(),
  /** When false, receipts omit the 80G block (e.g. approval lapsed). */
  showOnReceipt: boolean().notNull().default(true),
  ...timestamps,
});

export const inKindCategoryEnum = pgEnum('in_kind_category', [
  'gold',
  'silver',
  'jewellery',
  'grain',
  'cloth',
  'other',
]);
export const inKindDispositionEnum = pgEnum('in_kind_disposition', [
  'in_stock',
  'sold',
  'used',
  'returned',
]);

/**
 * A non-cash offering — gold, silver, jewellery, grain, cloth. Kept out of the
 * money ledger (it never hits cash) but recorded for audit and transparency,
 * with an indicative valuation and a disposition so the treasurer always knows
 * what physical offerings are still in hand.
 */
export const inKindDonations = pgTable(
  'in_kind_donations',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    devoteeId: uuid().references(() => devotees.id),
    donorName: text().notNull(),
    category: inKindCategoryEnum().notNull(),
    /** What was given — "Gold ring", "Silk saree", "Rice". */
    item: text().notNull(),
    quantity: numeric({ precision: 14, scale: 3 }),
    /** Unit for the quantity — "grams", "pieces", "bags". */
    unit: text(),
    /** Indicative valuation for audit; gold can be high, so 14 digits. */
    estimatedValue: numeric({ precision: 14, scale: 2 }),
    currency: currencyEnum().notNull(),
    receivedOn: date().notNull(),
    disposition: inKindDispositionEnum().notNull().default('in_stock'),
    disposalNote: text(),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [
    index('in_kind_donations_org_disposition_idx').on(t.organizationId, t.disposition),
    index('in_kind_donations_devotee_idx').on(t.devoteeId),
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

export const employmentTypeEnum = pgEnum('employment_type', [
  'salaried',
  'priest',
  'wage',
  'honorary',
]);

/**
 * A paid member of temple staff — priest, cook, cleaner, security, manager. The
 * register keeps the expected monthly salary; what was actually *paid* is never
 * stored here — it's derived from the expense ledger (vouchers tagged with
 * `expenses.employeeId`), so salary history always ties to the books.
 */
export const employees = pgTable(
  'employees',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    name: text().notNull(),
    /** Job title — Head Priest, Cook, Security, Manager… */
    designation: text(),
    employmentType: employmentTypeEnum().notNull().default('salaried'),
    /** Expected monthly salary/honorarium. Null for irregular wage staff. */
    monthlySalary: numeric({ precision: 12, scale: 2 }),
    phone: text(),
    email: text(),
    joinedOn: date(),
    isActive: boolean().notNull().default(true),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('employees_org_active_idx').on(t.organizationId, t.isActive)],
);

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
    /** Draws this expense from a fund — see `funds`. */
    fundId: uuid().references(() => funds.id),
    /** The bank/cash account this money was paid from — see `financialAccounts`. */
    accountId: uuid().references(() => financialAccounts.id),
    /** Set once this entry is reconciled against the bank statement (cleared). */
    clearedAt: timestamp({ withTimezone: true }),
    /** Set when this voucher is a salary/honorarium payment — see `employees`. */
    employeeId: uuid().references(() => employees.id),
    /** Set when this voucher utilizes grant money — see `grants`. */
    grantId: uuid().references(() => grants.id),
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
    index('expenses_fund_idx').on(t.fundId),
    index('expenses_account_idx').on(t.accountId),
    index('expenses_employee_idx').on(t.employeeId),
    index('expenses_grant_idx').on(t.grantId),
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
