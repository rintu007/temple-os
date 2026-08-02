import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';

/**
 * Platform-wide "what's new" entries — not tenant-scoped. Written by
 * TempleOS staff (platform admins) via /platform/changelog, read by every
 * signed-in user across every organization.
 */
export const changelogEntries = pgTable('changelog_entries', {
  id: id(),
  title: text().notNull(),
  body: text().notNull(),
  publishedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});

/**
 * One row per user — tracks how far they've read the changelog. No
 * organizationId: unlike notification_reads, changelog entries aren't
 * per-org events, so there's nothing to scope a read cursor to besides
 * the user themselves.
 */
export const changelogReads = pgTable('changelog_reads', {
  userId: uuid().primaryKey(),
  lastReadAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});
