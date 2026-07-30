import { index, integer, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { organizations } from './tenancy';

/** Who a broadcast targets. Recipient lists are computed at send time. */
export const broadcastSegmentEnum = pgEnum('broadcast_segment', ['all', 'donors', 'members']);

/** Delivery outcome — derived from the per-recipient send tally, then frozen. */
export const broadcastStatusEnum = pgEnum('broadcast_status', ['sent', 'partial', 'failed']);

/** Which channel carried the message — devotees are matched by email or phone accordingly. */
export const broadcastChannelEnum = pgEnum('broadcast_channel', ['email', 'whatsapp']);

/**
 * A broadcast sent to a segment of devotees, over email or WhatsApp (see
 * @templeos/email and @templeos/whatsapp). Immutable once sent — the row is
 * the record of what went out, to how many, and how many were delivered.
 * Individual sends are best-effort, so failedCount can be non-zero without
 * the broadcast failing as a whole.
 */
export const broadcasts = pgTable(
  'broadcasts',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    subject: text().notNull(),
    message: text().notNull(),
    segment: broadcastSegmentEnum().notNull(),
    channel: broadcastChannelEnum().notNull().default('email'),
    recipientCount: integer().notNull(),
    sentCount: integer().notNull(),
    failedCount: integer().notNull(),
    status: broadcastStatusEnum().notNull(),
    sentByUserId: uuid(),
    ...timestamps,
  },
  (t) => [index('broadcasts_org_created_idx').on(t.organizationId, t.createdAt)],
);
