import { date, index, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
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
