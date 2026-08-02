import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * One row per monitored service ('db', 'sites-app'). Written only by the
 * health-check cron; used to detect state transitions (up→down, down→up)
 * so alert emails fire once per transition, not on every 5-minute check.
 */
export const healthChecks = pgTable('health_checks', {
  service: text().primaryKey(),
  status: text().notNull(), // 'up' | 'down'
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
