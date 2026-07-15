import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { roles } from './identity';
import { organizations } from './tenancy';

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'revoked',
]);

/**
 * Staff invitations. The token is the capability: whoever holds the link can
 * view the invitation (via a token-scoped RLS policy) and accept it with a
 * matching signed-in email.
 */
export const invitations = pgTable(
  'invitations',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    email: text().notNull(),
    roleId: uuid()
      .notNull()
      .references(() => roles.id),
    token: text().notNull(),
    status: invitationStatusEnum().notNull().default('pending'),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    invitedByUserId: uuid(),
    acceptedByUserId: uuid(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('invitations_token_uq').on(t.token),
    index('invitations_org_idx').on(t.organizationId, t.status),
  ],
);
