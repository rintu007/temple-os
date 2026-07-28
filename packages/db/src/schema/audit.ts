import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { organizations } from './tenancy';

/** Append-only. Never updated, never hard-deleted. */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    actorUserId: uuid(),
    action: text().notNull(), // 'organization.created', 'donation.recorded', ...
    entityType: text().notNull(),
    entityId: uuid(),
    before: jsonb(),
    after: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_org_created_idx').on(t.organizationId, t.createdAt)],
);

/**
 * One row per (org, user) — the notification tray is derived from audit_logs
 * (every mutation already writes one), never denormalized into its own event
 * table. This just tracks how far each user has read.
 */
export const notificationReads = pgTable(
  'notification_reads',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    userId: uuid().notNull(),
    lastReadAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [uniqueIndex('notification_reads_org_user_uq').on(t.organizationId, t.userId)],
);
