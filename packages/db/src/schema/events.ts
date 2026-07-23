import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, softDelete, timestamps } from './helpers';
import { organizations, temples } from './tenancy';

export const eventKindEnum = pgEnum('event_kind', ['event', 'festival']);

/**
 * Events and festivals share one table — a festival is an event with
 * kind='festival'. Recurring festival rules (tithi-based dates) arrive later;
 * MVP records concrete dates.
 */
export const events = pgTable(
  'events',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    kind: eventKindEnum().notNull().default('event'),
    title: text().notNull(),
    description: text(),
    location: text(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }),
    allDay: boolean().notNull().default(false),
    isPublished: boolean().notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('events_org_starts_idx').on(t.organizationId, t.startsAt),
    index('events_org_kind_idx').on(t.organizationId, t.kind),
  ],
);

export const volunteerStatusEnum = pgEnum('volunteer_status', ['open', 'closed']);

/**
 * A volunteer opportunity — a duty the temple needs hands for (festival
 * seva, kitchen, crowd help). Optionally tied to an event. Devotees sign up
 * from the public site; staff see the roster.
 */
export const volunteerOpportunities = pgTable(
  'volunteer_opportunities',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    eventId: uuid().references(() => events.id),
    title: text().notNull(),
    description: text(),
    servingOn: date(),
    slotsNeeded: integer().notNull().default(0),
    status: volunteerStatusEnum().notNull().default('open'),
    ...timestamps,
  },
  (t) => [index('volunteer_opportunities_org_status_idx').on(t.organizationId, t.status)],
);

/** A devotee's sign-up for an opportunity. Public insert, org-scoped. */
export const volunteerSignups = pgTable(
  'volunteer_signups',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    opportunityId: uuid()
      .notNull()
      .references(() => volunteerOpportunities.id),
    name: text().notNull(),
    phone: text(),
    email: text(),
    note: text(),
    ...timestamps,
  },
  (t) => [index('volunteer_signups_opportunity_idx').on(t.opportunityId)],
);
