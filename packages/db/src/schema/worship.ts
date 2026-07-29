import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, softDelete, timestamps } from './helpers';
import { devotees } from './community';
import { currencyEnum, organizations, temples } from './tenancy';

/**
 * Daily schedule entries (aarti, puja, darshan hours). One flat list per
 * temple, same every day at MVP — festival-specific overrides arrive with the
 * festivals module.
 */
export const dailySchedules = pgTable(
  'daily_schedules',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid()
      .notNull()
      .references(() => temples.id),
    title: text().notNull(),
    startTime: time().notNull(),
    endTime: time(),
    description: text(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('daily_schedules_org_idx').on(t.organizationId),
    index('daily_schedules_temple_idx').on(t.templeId, t.startTime),
  ],
);

/** Catalog of pujas a temple offers for booking, each with a fixed price. */
export const pujaTypes = pgTable(
  'puja_types',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    name: text().notNull(),
    description: text(),
    price: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index('puja_types_org_idx').on(t.organizationId)],
);

/**
 * Priest / pujari roster. Priests are not login users — they are people the
 * temple assigns to sevas; staff manage the roster and the day schedule.
 */
export const priests = pgTable(
  'priests',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    templeId: uuid().references(() => temples.id),
    name: text().notNull(),
    phone: text(),
    specialty: text(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [index('priests_org_idx').on(t.organizationId)],
);

/**
 * Recurring duty roster: which priest covers a given daily-schedule ritual,
 * and on which days. An empty daysOfWeek means every day. This is the
 * standing rota — a puja booking's one-off priest assignment (puja_bookings)
 * is separate and doesn't touch this table.
 */
export const priestDutyAssignments = pgTable(
  'priest_duty_assignments',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    priestId: uuid()
      .notNull()
      .references(() => priests.id),
    dailyScheduleId: uuid()
      .notNull()
      .references(() => dailySchedules.id),
    /** 0=Sunday..6=Saturday. Empty array means every day. */
    daysOfWeek: integer().array().notNull().default([]),
    notes: text(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('priest_duty_assignments_org_idx').on(t.organizationId),
    index('priest_duty_assignments_priest_idx').on(t.priestId),
    index('priest_duty_assignments_schedule_idx').on(t.dailyScheduleId),
  ],
);

/** A priest's time-off window — used to flag duty-roster days needing a substitute. */
export const priestLeaves = pgTable(
  'priest_leaves',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    priestId: uuid()
      .notNull()
      .references(() => priests.id),
    startDate: date().notNull(),
    endDate: date().notNull(),
    reason: text(),
    ...timestamps,
  },
  (t) => [
    index('priest_leaves_org_idx').on(t.organizationId),
    index('priest_leaves_priest_idx').on(t.priestId),
  ],
);

export const pujaBookingStatusEnum = pgEnum('puja_booking_status', [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
]);

/**
 * A devotee's booking of a puja. Created 'pending' when checkout starts;
 * moves to 'confirmed' when payment is verified (and a donation row is
 * written for income/receipt). Staff mark it 'completed' after the puja is
 * performed. pujaName is snapshotted so history survives type edits.
 */
export const pujaBookings = pgTable(
  'puja_bookings',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    pujaTypeId: uuid().references(() => pujaTypes.id),
    pujaName: text().notNull(),
    devoteeId: uuid().references(() => devotees.id),
    devoteeName: text().notNull(),
    email: text(),
    phone: text(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum().notNull(),
    preferredDate: date(),
    note: text(),
    /** Seva scheduling — set by staff after the booking is confirmed. */
    priestId: uuid().references(() => priests.id),
    scheduledOn: date(),
    scheduledTime: time(),
    status: pujaBookingStatusEnum().notNull().default('pending'),
    provider: text(),
    providerOrderId: text(),
    providerPaymentId: text(),
    ...timestamps,
  },
  (t) => [
    index('puja_bookings_org_status_idx').on(t.organizationId, t.status),
    index('puja_bookings_provider_order_idx').on(t.providerOrderId),
  ],
);
