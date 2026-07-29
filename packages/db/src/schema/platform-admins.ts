import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './helpers';
import { users } from './identity';

/**
 * TempleOS staff (not tenant staff) who can view cross-organization platform
 * data — every org's plan, subscription status, and MRR — from apps/admin's
 * /platform section. Membership is granted by inserting a row directly in
 * the database; there is no self-service UI for this in v1.
 */
export const platformAdmins = pgTable('platform_admins', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id),
  note: text(),
  ...timestamps,
});
