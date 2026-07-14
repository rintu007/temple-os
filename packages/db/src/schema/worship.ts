import { boolean, index, pgTable, text, time, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { organizations, temples } from './tenancy';

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
