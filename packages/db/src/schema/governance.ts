import { boolean, date, index, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { organizations } from './tenancy';

export const meetingStatusEnum = pgEnum('meeting_status', ['scheduled', 'held', 'cancelled']);

/**
 * A governance meeting record for the temple's trust / managing committee.
 * Created 'scheduled' with an agenda; after it happens the secretary fills
 * the minutes and decisions and marks it 'held'. `body` is the committee name
 * as free text (e.g. "Board of Trustees") — lightweight until a committees
 * table is warranted.
 */
export const meetings = pgTable(
  'meetings',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    title: text().notNull(),
    body: text(),
    meetingOn: date().notNull(),
    location: text(),
    attendees: text(),
    agenda: text(),
    minutes: text(),
    decisions: text(),
    status: meetingStatusEnum().notNull().default('scheduled'),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('meetings_org_date_idx').on(t.organizationId, t.meetingOn)],
);

/**
 * An office bearer / trustee of the temple's managing body — the statutory
 * "who runs this" record that registered trusts must maintain. `isActive`
 * marks the sitting members; former bearers are kept (never deleted) with an
 * end date for the historical record.
 */
export const officeBearers = pgTable(
  'office_bearers',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    name: text().notNull(),
    designation: text().notNull(),
    /** Committee / body they belong to, free text (e.g. "Board of Trustees"). */
    body: text(),
    phone: text(),
    email: text(),
    termStartsOn: date(),
    termEndsOn: date(),
    isActive: boolean().notNull().default(true),
    note: text(),
    recordedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('office_bearers_org_active_idx').on(t.organizationId, t.isActive)],
);
