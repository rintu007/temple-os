import {
  boolean,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { organizations } from './tenancy';

export const membershipStatusEnum = pgEnum('membership_status', ['invited', 'active', 'disabled']);

/**
 * Mirrors Supabase auth.users (same id). Profile fields live here so business
 * queries never join across the auth schema.
 */
export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey(), // = auth.users.id, no default
    email: text().notNull(),
    fullName: text(),
    avatarUrl: text(),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email)],
);

/** Per-organization roles. System roles (owner/admin/manager/staff/viewer) are seeded per org. */
export const roles = pgTable(
  'roles',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    key: text().notNull(), // 'owner' | 'admin' | ... | custom keys later
    name: text().notNull(),
    isSystem: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('roles_org_key_uq').on(t.organizationId, t.key)],
);

/** Global permission catalog, e.g. 'donations:create', 'reports:view'. */
export const permissions = pgTable('permissions', {
  key: text().primaryKey(),
  description: text().notNull(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid()
      .notNull()
      .references(() => roles.id),
    permissionKey: text()
      .notNull()
      .references(() => permissions.key),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })],
);

/** User ↔ organization link. templeIds null means access to all temples in the org. */
export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    roleId: uuid()
      .notNull()
      .references(() => roles.id),
    status: membershipStatusEnum().notNull().default('active'),
    templeIds: uuid().array(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('memberships_org_user_uq').on(t.organizationId, t.userId),
    index('memberships_user_idx').on(t.userId),
  ],
);
