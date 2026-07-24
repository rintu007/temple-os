import { forbidden, type DomainError } from './errors';
import { err, ok, type Result } from './result';
import type { TenantContext } from './tenant-context';

export type Permission =
  | 'organization:manage'
  | 'temples:read'
  | 'temples:write'
  | 'schedules:write'
  | 'devotees:read'
  | 'devotees:write'
  | 'donations:read'
  | 'donations:write'
  | 'donations:void'
  | 'expenses:read'
  | 'expenses:write'
  | 'expenses:void'
  | 'events:read'
  | 'events:write'
  | 'pujas:read'
  | 'pujas:write'
  | 'membership:read'
  | 'membership:write'
  | 'reports:read'
  | 'website:read'
  | 'website:write'
  | 'volunteers:read'
  | 'volunteers:write'
  | 'facilities:read'
  | 'facilities:write'
  | 'prasadam:read'
  | 'prasadam:write'
  | 'assets:read'
  | 'assets:write'
  | 'governance:read'
  | 'governance:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'overview:read';

/**
 * Interim role→permission map for the seeded system roles. Becomes a
 * table-driven lookup (roles/permissions/role_permissions) when custom roles
 * ship — the authorize() call sites do not change.
 */
const ALL: readonly Permission[] = [
  'organization:manage',
  'temples:read',
  'temples:write',
  'schedules:write',
  'devotees:read',
  'devotees:write',
  'donations:read',
  'donations:write',
  'donations:void',
  'expenses:read',
  'expenses:write',
  'expenses:void',
  'events:read',
  'events:write',
  'pujas:read',
  'pujas:write',
  'membership:read',
  'membership:write',
  'reports:read',
  'website:read',
  'website:write',
  'volunteers:read',
  'volunteers:write',
  'facilities:read',
  'facilities:write',
  'prasadam:read',
  'prasadam:write',
  'assets:read',
  'assets:write',
  'governance:read',
  'governance:write',
  'inventory:read',
  'inventory:write',
  'overview:read',
];

const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  owner: ALL,
  admin: ALL,
  manager: [
    'temples:read',
    'temples:write',
    'schedules:write',
    'devotees:read',
    'devotees:write',
    'donations:read',
    'donations:write',
    'donations:void',
    'expenses:read',
    'expenses:write',
    'expenses:void',
    'events:read',
    'events:write',
    'pujas:read',
    'pujas:write',
    'membership:read',
    'membership:write',
    'reports:read',
    'website:read',
    'website:write',
    'volunteers:read',
    'volunteers:write',
    'facilities:read',
    'facilities:write',
    'prasadam:read',
    'prasadam:write',
    'assets:read',
    'assets:write',
    'governance:read',
    'governance:write',
    'inventory:read',
    'inventory:write',
    'overview:read',
  ],
  staff: [
    'temples:read',
    'schedules:write',
    'devotees:read',
    'devotees:write',
    'donations:read',
    'donations:write',
    'expenses:read',
    'expenses:write',
    'events:read',
    'events:write',
    'pujas:read',
    'pujas:write',
    'membership:read',
    'membership:write',
    'website:read',
    'volunteers:read',
    'volunteers:write',
    'facilities:read',
    'facilities:write',
    'prasadam:read',
    'prasadam:write',
    'assets:read',
    'assets:write',
    'governance:read',
    'inventory:read',
    'inventory:write',
    'overview:read',
  ],
  viewer: [
    'temples:read',
    'devotees:read',
    'donations:read',
    'expenses:read',
    'events:read',
    'pujas:read',
    'membership:read',
    'website:read',
    'volunteers:read',
    'facilities:read',
    'prasadam:read',
    'assets:read',
    'governance:read',
    'inventory:read',
    'overview:read',
  ],
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
