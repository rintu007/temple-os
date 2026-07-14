import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, softDelete, timestamps } from './helpers';

export const countryEnum = pgEnum('country', ['IN', 'BD']);
export const currencyEnum = pgEnum('currency', ['INR', 'BDT']);
export const organizationStatusEnum = pgEnum('organization_status', [
  'pending',
  'active',
  'suspended',
]);
export const domainTypeEnum = pgEnum('domain_type', ['subdomain', 'custom']);

/** Tenancy root: the billing and isolation boundary. Every tenant table carries organizationId. */
export const organizations = pgTable(
  'organizations',
  {
    id: id(),
    name: text().notNull(),
    slug: text().notNull(),
    country: countryEnum().notNull(),
    currency: currencyEnum().notNull(),
    status: organizationStatusEnum().notNull().default('pending'),
    ...timestamps,
    ...softDelete,
  },
  (t) => [uniqueIndex('organizations_slug_uq').on(t.slug)],
);

export const temples = pgTable(
  'temples',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    name: text().notNull(),
    slug: text().notNull(),
    deity: text(),
    addressLine1: text(),
    addressLine2: text(),
    city: text(),
    state: text(),
    postalCode: text(),
    country: countryEnum().notNull(),
    phone: text(),
    email: text(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('temples_org_idx').on(t.organizationId),
    uniqueIndex('temples_org_slug_uq').on(t.organizationId, t.slug),
  ],
);

export const branches = pgTable(
  'branches',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid()
      .notNull()
      .references(() => temples.id),
    name: text().notNull(),
    city: text(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index('branches_org_idx').on(t.organizationId)],
);

/** Hostnames that resolve to a tenant site: `{slug}.templeos.com` rows plus custom domains later. */
export const domains = pgTable(
  'domains',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    hostname: text().notNull(),
    type: domainTypeEnum().notNull().default('subdomain'),
    isPrimary: boolean().notNull().default(false),
    verifiedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('domains_hostname_uq').on(t.hostname),
    index('domains_org_idx').on(t.organizationId),
  ],
);
