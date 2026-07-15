import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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
