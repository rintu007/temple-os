import { boolean, date, index, integer, pgEnum, pgTable, text, time, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { organizations, temples } from './tenancy';

/**
 * A capacity-limited darshan / special-entry slot on a given day. Devotees
 * book free timed-entry tokens against it; the sum of booked party sizes may
 * not exceed `capacity`. Distinct from paid puja bookings and hall bookings.
 */
export const darshanSlots = pgTable(
  'darshan_slots',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    name: text().notNull(),
    slotDate: date().notNull(),
    startTime: time().notNull(),
    endTime: time(),
    capacity: integer().notNull(),
    note: text(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [index('darshan_slots_org_date_idx').on(t.organizationId, t.slotDate)],
);

export const darshanTokenStatusEnum = pgEnum('darshan_token_status', ['booked', 'used', 'cancelled']);

/**
 * A booked token against a slot. tokenNumber is sequential per slot, assigned
 * under a row lock on the slot so concurrent bookings never collide or
 * overbook. partySize counts against the slot capacity.
 */
export const darshanTokens = pgTable(
  'darshan_tokens',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    slotId: uuid()
      .notNull()
      .references(() => darshanSlots.id),
    tokenNumber: integer().notNull(),
    devoteeName: text().notNull(),
    phone: text(),
    email: text(),
    partySize: integer().notNull().default(1),
    status: darshanTokenStatusEnum().notNull().default('booked'),
    note: text(),
    ...timestamps,
  },
  (t) => [index('darshan_tokens_slot_idx').on(t.slotId, t.status)],
);
