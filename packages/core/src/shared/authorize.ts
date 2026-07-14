import { forbidden, type DomainError } from './errors';
import { err, ok, type Result } from './result';
import type { TenantContext } from './tenant-context';

export type Permission =
  | 'organization:manage'
  | 'temples:read'
  | 'temples:write'
  | 'schedules:write';

/**
 * Interim role→permission map for the seeded system roles. Becomes a
 * table-driven lookup (roles/permissions/role_permissions) when custom roles
 * ship — the authorize() call sites do not change.
 */
const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  owner: ['organization:manage', 'temples:read', 'temples:write', 'schedules:write'],
  admin: ['organization:manage', 'temples:read', 'temples:write', 'schedules:write'],
  manager: ['temples:read', 'temples:write', 'schedules:write'],
  staff: ['temples:read', 'schedules:write'],
  viewer: ['temples:read'],
};

export function can(ctx: TenantContext, permission: Permission): boolean {
  return ROLE_PERMISSIONS[ctx.roleKey]?.includes(permission) ?? false;
}

/** Service-layer guard: every mutating service method calls this first. */
export function authorize(ctx: TenantContext, permission: Permission): Result<null, DomainError> {
  if (!can(ctx, permission)) {
    return err(forbidden());
  }
  return ok(null);
}
