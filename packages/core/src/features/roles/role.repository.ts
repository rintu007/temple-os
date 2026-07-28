import { and, count, eq, inArray } from 'drizzle-orm';
import {
  auditLogs,
  memberships,
  newId,
  rolePermissions,
  roles,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { Permission, TenantContext } from '../../shared';
import { SYSTEM_ROLES } from '../organizations';

const SYSTEM_KEYS = new Set<string>(SYSTEM_ROLES.map((r) => r.key));

/** Appends '-2', '-3'... until the key is free within the org. */
async function uniqueKey(tx: Tx, organizationId: string, base: string): Promise<string> {
  const rows = await tx
    .select({ key: roles.key })
    .from(roles)
    .where(eq(roles.organizationId, organizationId));
  const taken = new Set(rows.map((r) => r.key));
  if (!taken.has(base) && !SYSTEM_KEYS.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'role'
  );
}

export function createRoleRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async list(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const roleRows = await tx
          .select()
          .from(roles)
          .where(eq(roles.organizationId, ctx.organizationId));

        const [permCounts, memberCounts] = await Promise.all([
          tx
            .select({ roleId: rolePermissions.roleId, value: count() })
            .from(rolePermissions)
            .where(
              inArray(
                rolePermissions.roleId,
                roleRows.map((r) => r.id),
              ),
            )
            .groupBy(rolePermissions.roleId),
          tx
            .select({ roleId: memberships.roleId, value: count() })
            .from(memberships)
            .where(eq(memberships.organizationId, ctx.organizationId))
            .groupBy(memberships.roleId),
        ]);
        const permCountByRole = new Map(permCounts.map((r) => [r.roleId, r.value]));
        const memberCountByRole = new Map(memberCounts.map((r) => [r.roleId, r.value]));

        return roleRows.map((r) => ({
          ...r,
          permCount: permCountByRole.get(r.id) ?? 0,
          memberCount: memberCountByRole.get(r.id) ?? 0,
        }));
      });
    },

    async findById(ctx: TenantContext, roleId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [role] = await tx
          .select()
          .from(roles)
          .where(and(eq(roles.id, roleId), eq(roles.organizationId, ctx.organizationId)))
          .limit(1);
        if (!role) return null;

        const [permRows, [memberCountRow]] = await Promise.all([
          tx
            .select({ key: rolePermissions.permissionKey })
            .from(rolePermissions)
            .where(eq(rolePermissions.roleId, roleId)),
          tx
            .select({ value: count() })
            .from(memberships)
            .where(eq(memberships.roleId, roleId)),
        ]);
        return {
          ...role,
          permissionKeys: permRows.map((p) => p.key) as Permission[],
          memberCount: memberCountRow?.value ?? 0,
        };
      });
    },

    /** Fast path for authorize() — null means "use the static system-role map". */
    async resolvePermissions(organizationId: string, roleKey: string): Promise<Permission[] | null> {
      if (SYSTEM_KEYS.has(roleKey)) return null;
      return withTenantContext(db, { organizationId }, async (tx) => {
        const rows = await tx
          .select({ key: rolePermissions.permissionKey })
          .from(rolePermissions)
          .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
          .where(and(eq(roles.organizationId, organizationId), eq(roles.key, roleKey)));
        return rows.map((r) => r.key) as Permission[];
      });
    },

    async create(ctx: TenantContext, name: string, permissionKeys: Permission[]) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const key = await uniqueKey(tx, ctx.organizationId, slugify(name));
        const [role] = await tx
          .insert(roles)
          .values({ id: newId(), organizationId: ctx.organizationId, key, name, isSystem: false })
          .returning();
        if (!role) throw new Error('role insert returned no row');

        if (permissionKeys.length > 0) {
          await tx
            .insert(rolePermissions)
            .values(permissionKeys.map((permissionKey) => ({ roleId: role.id, permissionKey })));
        }

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'role.created',
          entityType: 'role',
          entityId: role.id,
          after: { name, key, permissionCount: permissionKeys.length },
        });
        return role;
      });
    },

    /** Guards against isSystem in the service layer — repository trusts the caller. */
    async update(ctx: TenantContext, roleId: string, name: string, permissionKeys: Permission[]) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(roles)
          .set({ name })
          .where(and(eq(roles.id, roleId), eq(roles.isSystem, false)))
          .returning();
        if (!updated) return null;

        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
        if (permissionKeys.length > 0) {
          await tx
            .insert(rolePermissions)
            .values(permissionKeys.map((permissionKey) => ({ roleId, permissionKey })));
        }

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'role.updated',
          entityType: 'role',
          entityId: roleId,
          after: { name, permissionCount: permissionKeys.length },
        });
        return updated;
      });
    },

    async delete(ctx: TenantContext, roleId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [[memberCountRow], [role]] = await Promise.all([
          tx.select({ value: count() }).from(memberships).where(eq(memberships.roleId, roleId)),
          tx
            .select()
            .from(roles)
            .where(and(eq(roles.id, roleId), eq(roles.organizationId, ctx.organizationId)))
            .limit(1),
        ]);
        if (!role) return { kind: 'not_found' as const };
        if (role.isSystem) return { kind: 'system_role' as const };
        if ((memberCountRow?.value ?? 0) > 0) return { kind: 'in_use' as const };

        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
        await tx.delete(roles).where(eq(roles.id, roleId));

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'role.deleted',
          entityType: 'role',
          entityId: roleId,
          after: { name: role.name },
        });
        return { kind: 'ok' as const };
      });
    },
  };
}

export type RoleRepository = ReturnType<typeof createRoleRepository>;
