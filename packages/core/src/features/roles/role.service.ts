import type { Db } from '@templeos/db';
import { roleSchema } from '@templeos/validators';
import {
  ALL_PERMISSIONS,
  authorize,
  conflict,
  domainError,
  err,
  notFound,
  ok,
  systemRolePermissions,
  type Permission,
  type Result,
  type TenantContext,
} from '../../shared';
import { createRoleRepository } from './role.repository';
import type { RoleDetail, RoleSummary } from './role.types';

const KNOWN = new Set<string>(ALL_PERMISSIONS);

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

/** Drops any key that isn't a real, current Permission — belt and suspenders under the FK. */
function sanitizePermissionKeys(keys: string[]): Permission[] {
  return keys.filter((k): k is Permission => KNOWN.has(k));
}

export function createRoleService({ db }: { db: Db }) {
  const repo = createRoleRepository(db);

  return {
    async listRoles(ctx: TenantContext): Promise<Result<RoleSummary[]>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx);
      return ok(
        rows
          .map((r) => ({
            id: r.id,
            key: r.key,
            name: r.name,
            isSystem: r.isSystem,
            permissionCount: r.isSystem
              ? (systemRolePermissions(r.key)?.length ?? 0)
              : r.permCount,
            memberCount: r.memberCount,
          }))
          .sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name)),
      );
    },

    async getRole(ctx: TenantContext, roleId: string): Promise<Result<RoleDetail>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, roleId);
      if (!row) return err(notFound('Role'));
      const permissionKeys = row.isSystem
        ? [...(systemRolePermissions(row.key) ?? [])]
        : row.permissionKeys;
      return ok({
        id: row.id,
        key: row.key,
        name: row.name,
        isSystem: row.isSystem,
        permissionCount: permissionKeys.length,
        memberCount: row.memberCount,
        permissionKeys,
      });
    },

    async createRole(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;
      const parsed = roleSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const permissionKeys = sanitizePermissionKeys(parsed.data.permissionKeys);
      if (permissionKeys.length === 0) {
        return err(domainError('VALIDATION', 'Select at least one valid permission'));
      }
      const role = await repo.create(ctx, parsed.data.name, permissionKeys);
      return ok({ id: role.id });
    },

    async updateRole(
      ctx: TenantContext,
      roleId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;
      const parsed = roleSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const permissionKeys = sanitizePermissionKeys(parsed.data.permissionKeys);
      if (permissionKeys.length === 0) {
        return err(domainError('VALIDATION', 'Select at least one valid permission'));
      }
      const updated = await repo.update(ctx, roleId, parsed.data.name, permissionKeys);
      if (!updated) return err(notFound('Role'));
      return ok({ id: updated.id });
    },

    async deleteRole(ctx: TenantContext, roleId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;
      const result = await repo.delete(ctx, roleId);
      if (result.kind === 'not_found') return err(notFound('Role'));
      if (result.kind === 'system_role') {
        return err(domainError('VALIDATION', 'System roles cannot be deleted'));
      }
      if (result.kind === 'in_use') {
        return err(conflict('Reassign every member with this role before deleting it'));
      }
      return ok(null);
    },

    /** requireTenantContext() calls this once per request — null means "use the static map". */
    async resolvePermissions(organizationId: string, roleKey: string): Promise<Permission[] | null> {
      return repo.resolvePermissions(organizationId, roleKey);
    },
  };
}

export type RoleService = ReturnType<typeof createRoleService>;
