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
  | 'expenses:approve'
  | 'funds:read'
  | 'funds:write'
  | 'accounts:read'
  | 'accounts:write'
  | 'payroll:read'
  | 'payroll:write'
  | 'loans:read'
  | 'loans:write'
  | 'investments:read'
  | 'investments:write'
  | 'grants:read'
  | 'grants:write'
  | 'budgets:read'
  | 'budgets:write'
  | 'tax:read'
  | 'tax:write'
  | 'events:read'
  | 'events:write'
  | 'pujas:read'
  | 'pujas:write'
  | 'sevas:read'
  | 'sevas:write'
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
  | 'darshan:read'
  | 'darshan:write'
  | 'communications:read'
  | 'communications:write'
  | 'overview:read';

/**
 * Every permission, grouped for the roles UI. This is the single source of
 * truth: `ALL` (below), the `permissions` catalog table seed, and the custom
 * role editor's checkbox list all derive from this.
 */
export const PERMISSION_GROUPS: ReadonlyArray<{ label: string; permissions: readonly Permission[] }> = [
  { label: 'Organization', permissions: ['organization:manage'] },
  { label: 'Temples & schedules', permissions: ['temples:read', 'temples:write', 'schedules:write'] },
  { label: 'Devotees', permissions: ['devotees:read', 'devotees:write'] },
  { label: 'Donations', permissions: ['donations:read', 'donations:write', 'donations:void'] },
  {
    label: 'Expenses',
    permissions: ['expenses:read', 'expenses:write', 'expenses:void', 'expenses:approve'],
  },
  { label: 'Funds', permissions: ['funds:read', 'funds:write'] },
  { label: 'Bank & cash accounts', permissions: ['accounts:read', 'accounts:write'] },
  { label: 'Payroll', permissions: ['payroll:read', 'payroll:write'] },
  { label: 'Loans & advances', permissions: ['loans:read', 'loans:write'] },
  { label: 'Investments', permissions: ['investments:read', 'investments:write'] },
  { label: 'Grants', permissions: ['grants:read', 'grants:write'] },
  { label: 'Budgets', permissions: ['budgets:read', 'budgets:write'] },
  { label: '80G & tax', permissions: ['tax:read', 'tax:write'] },
  { label: 'Events', permissions: ['events:read', 'events:write'] },
  { label: 'Pujas', permissions: ['pujas:read', 'pujas:write'] },
  { label: 'Sevas', permissions: ['sevas:read', 'sevas:write'] },
  { label: 'Membership', permissions: ['membership:read', 'membership:write'] },
  { label: 'Reports', permissions: ['reports:read'] },
  { label: 'Website', permissions: ['website:read', 'website:write'] },
  { label: 'Volunteers', permissions: ['volunteers:read', 'volunteers:write'] },
  { label: 'Facilities', permissions: ['facilities:read', 'facilities:write'] },
  { label: 'Annadanam / prasadam', permissions: ['prasadam:read', 'prasadam:write'] },
  { label: 'Assets', permissions: ['assets:read', 'assets:write'] },
  {
    label: 'Governance (activity, officers, meetings)',
    permissions: ['governance:read', 'governance:write'],
  },
  { label: 'Inventory', permissions: ['inventory:read', 'inventory:write'] },
  { label: 'Darshan', permissions: ['darshan:read', 'darshan:write'] },
  { label: 'Communications', permissions: ['communications:read', 'communications:write'] },
  { label: 'Dashboard overview', permissions: ['overview:read'] },
];

/** 'donations:read' → 'View'; used with the group label for a checkbox caption. */
const ACTION_LABELS: Record<string, string> = {
  read: 'View',
  write: 'Create & edit',
  void: 'Void',
  approve: 'Approve',
  manage: 'Full management',
};

export function actionLabel(permission: Permission): string {
  const suffix = permission.split(':')[1] ?? permission;
  return ACTION_LABELS[suffix] ?? suffix;
}

/** Every permission — derived from PERMISSION_GROUPS so the two can't drift apart. */
export const ALL_PERMISSIONS: readonly Permission[] = PERMISSION_GROUPS.flatMap(
  (g) => g.permissions,
);

/** Interim role→permission map for the seeded system roles. */
const ALL: readonly Permission[] = ALL_PERMISSIONS;

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
    'expenses:approve',
    'funds:read',
    'funds:write',
    'accounts:read',
    'accounts:write',
    'payroll:read',
    'payroll:write',
    'loans:read',
    'loans:write',
    'investments:read',
    'investments:write',
    'grants:read',
    'grants:write',
    'budgets:read',
    'budgets:write',
    'tax:read',
    'tax:write',
    'events:read',
    'events:write',
    'pujas:read',
    'pujas:write',
    'sevas:read',
    'sevas:write',
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
    'darshan:read',
    'darshan:write',
    'communications:read',
    'communications:write',
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
    'funds:read',
    'accounts:read',
    'loans:read',
    'investments:read',
    'grants:read',
    'budgets:read',
    'tax:read',
    'events:read',
    'events:write',
    'pujas:read',
    'pujas:write',
    'sevas:read',
    'sevas:write',
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
    'darshan:read',
    'darshan:write',
    'communications:read',
    'overview:read',
  ],
  viewer: [
    'temples:read',
    'devotees:read',
    'donations:read',
    'expenses:read',
    'funds:read',
    'accounts:read',
    'loans:read',
    'investments:read',
    'grants:read',
    'budgets:read',
    'tax:read',
    'events:read',
    'pujas:read',
    'sevas:read',
    'membership:read',
    'website:read',
    'volunteers:read',
    'facilities:read',
    'prasadam:read',
    'assets:read',
    'governance:read',
    'inventory:read',
    'darshan:read',
    'communications:read',
    'overview:read',
  ],
};

/** The static permission set for one of the 5 system roles, or undefined for a custom role key. */
export function systemRolePermissions(roleKey: string): readonly Permission[] | undefined {
  return ROLE_PERMISSIONS[roleKey];
}

/**
 * ctx.permissions (resolved once per request for custom roles — see
 * requireTenantContext) wins when present; otherwise falls back to the
 * static system-role map. System-role contexts never need ctx.permissions
 * set at all, which is why every test that builds a bare `{ roleKey: 'owner', ... }`
 * context keeps working unchanged.
 */
export function can(ctx: TenantContext, permission: Permission): boolean {
  const granted = ctx.permissions ?? ROLE_PERMISSIONS[ctx.roleKey];
  return granted?.includes(permission) ?? false;
}

/** Service-layer guard: every mutating service method calls this first. */
export function authorize(ctx: TenantContext, permission: Permission): Result<null, DomainError> {
  if (!can(ctx, permission)) {
    return err(forbidden());
  }
  return ok(null);
}
