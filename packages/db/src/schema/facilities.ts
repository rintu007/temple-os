import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { currencyEnum, organizations } from './tenancy';

/**
 * A bookable facility — marriage hall, community room, guest house. Rent is
 * indicative; the actual amount is recorded on the booking when confirmed.
 */
export const facilities = pgTable(
  'facilities',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    name: text().notNull(),
    description: text(),
    capacity: integer(),
    rentAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [index('facilities_org_idx').on(t.organizationId)],
);

export const facilityBookingStatusEnum = pgEnum('facility_booking_status', [
  'requested',
  'confirmed',
  'cancelled',
]);

/**
 * A booking of a facility for a single date. Devotees request from the public
 * site ('requested'); staff confirm after checking availability. A DB partial
 * unique index guarantees at most one 'confirmed' booking per facility+date,
 * so double-booking is impossible even under a race.
 */
export const facilityBookings = pgTable(
  'facility_bookings',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id),
    facilityName: text().notNull(),
    bookerName: text().notNull(),
    phone: text(),
    email: text(),
    eventDate: date().notNull(),
    purpose: text(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    status: facilityBookingStatusEnum().notNull().default('requested'),
    note: text(),
    ...timestamps,
  },
  (t) => [
    index('facility_bookings_org_status_idx').on(t.organizationId, t.status),
    // At most one confirmed booking per facility per date — enforced by the DB.
    uniqueIndex('facility_bookings_confirmed_slot_uq')
      .on(t.facilityId, t.eventDate)
      .where(sql`${t.status} = 'confirmed'`),
  ],
);
