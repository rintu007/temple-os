import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { timestamps } from './helpers';

/**
 * Fixed-window rate-limit counters for public, unauthenticated Server Actions
 * (login, magic-link requests, contact forms, checkout initiation) — not
 * organization-scoped, since abuse is tracked by caller (IP/email), not
 * tenant, and many of these actions run before any org/user context exists.
 * One row per (action, identifier, window); see
 * packages/core/src/features/rate-limit for how bucketKey is built and how
 * expired rows get opportunistically cleaned up.
 */
export const rateLimits = pgTable('rate_limits', {
  bucketKey: text().primaryKey(),
  count: integer().notNull().default(1),
  windowExpiresAt: timestamp({ withTimezone: true }).notNull(),
  ...timestamps,
});
