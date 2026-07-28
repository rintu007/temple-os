import { date, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, softDelete, timestamps } from './helpers';
import { organizations } from './tenancy';

export const genderEnum = pgEnum('gender', ['male', 'female', 'other']);
export const devoteeStatusEnum = pgEnum('devotee_status', ['active', 'archived']);

/** Household grouping — devotees optionally belong to one family. */
export const families = pgTable(
  'families',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    name: text().notNull(),
    ...timestamps,
  },
  (t) => [index('families_org_name_idx').on(t.organizationId, t.name)],
);

export const devotees = pgTable(
  'devotees',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    familyId: uuid().references(() => families.id),
    fullName: text().notNull(),
    email: text(),
    phone: text(),
    gender: genderEnum(),
    dateOfBirth: date(),
    addressLine1: text(),
    city: text(),
    state: text(),
    postalCode: text(),
    notes: text(),
    status: devoteeStatusEnum().notNull().default('active'),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('devotees_org_name_idx').on(t.organizationId, t.fullName),
    index('devotees_org_status_idx').on(t.organizationId, t.status),
    index('devotees_family_idx').on(t.familyId),
  ],
);

/**
 * One-time magic-link tokens for the devotee self-service portal. The org is
 * always known from the site domain before the token is looked up, so — unlike
 * staff invitations — no token-scoped RLS policy is needed; the standard
 * org-isolation policy is enough.
 */
export const devoteeLoginTokens = pgTable(
  'devotee_login_tokens',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    devoteeId: uuid()
      .notNull()
      .references(() => devotees.id),
    token: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('devotee_login_tokens_token_uq').on(t.token),
    index('devotee_login_tokens_org_idx').on(t.organizationId),
  ],
);

/** A signed-in devotee portal session, keyed by an opaque bearer token in a cookie. */
export const devoteeSessions = pgTable(
  'devotee_sessions',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    devoteeId: uuid()
      .notNull()
      .references(() => devotees.id),
    token: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('devotee_sessions_token_uq').on(t.token),
    index('devotee_sessions_org_idx').on(t.organizationId),
  ],
);
