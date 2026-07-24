import { date, index, integer, numeric, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { currencyEnum, organizations, temples } from './tenancy';

export const assetCategoryEnum = pgEnum('asset_category', [
  'jewelry',
  'vessels',
  'idols',
  'land',
  'building',
  'vehicle',
  'furniture',
  'electronics',
  'other',
]);

export const assetStatusEnum = pgEnum('asset_status', ['active', 'disposed']);

/**
 * A temple asset or valuable held for the audit/insurance register — gold and
 * silver jewellery, ritual vessels, idols, land, vehicles. Estimated value is
 * indicative (for insurance/audit), never an accounting balance, so it lives
 * here rather than in the ledger. Assets are 'disposed', never deleted, so the
 * register keeps a full history.
 */
export const assets = pgTable(
  'assets',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    name: text().notNull(),
    category: assetCategoryEnum().notNull(),
    description: text(),
    quantity: integer().notNull().default(1),
    /** Indicative valuation for insurance/audit — gold can be very high, so 14 digits. */
    estimatedValue: numeric({ precision: 14, scale: 2 }),
    currency: currencyEnum().notNull(),
    acquiredOn: date(),
    location: text(),
    status: assetStatusEnum().notNull().default('active'),
    disposalReason: text(),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('assets_org_status_idx').on(t.organizationId, t.status)],
);
