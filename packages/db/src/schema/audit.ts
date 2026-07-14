import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id } from './helpers';
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
