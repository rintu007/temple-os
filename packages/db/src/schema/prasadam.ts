import { date, index, integer, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { organizations, temples } from './tenancy';
import { donations } from './finance';

export const prasadamMealEnum = pgEnum('prasadam_meal', [
  'breakfast',
  'lunch',
  'dinner',
  'prasadam',
]);

/**
 * A single serving session of free food — annadanam (community meal) or
 * prasadam distribution. Records how many were served on a day, optionally
 * who sponsored it. When a sponsor amount is entered, a donation row is
 * created (category "Annadanam Sponsorship") and linked here, so sponsorship
 * income flows into the ledger like any other donation.
 */
export const prasadamSessions = pgTable(
  'prasadam_sessions',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    servedOn: date().notNull(),
    meal: prasadamMealEnum().notNull(),
    servedCount: integer().notNull().default(0),
    sponsorName: text(),
    /** Optional sponsorship donation this session generated. */
    sponsorDonationId: uuid().references(() => donations.id),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('prasadam_sessions_org_date_idx').on(t.organizationId, t.servedOn)],
);
