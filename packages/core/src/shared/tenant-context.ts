/**
 * The verified tenant identity for a request. Constructed ONLY from a verified
 * session (JWT claims) — never from client-supplied ids. Every repository
 * method takes this as its first argument; there is no unscoped data access.
 */
export interface TenantContext {
  readonly organizationId: string;
  readonly userId: string;
  readonly roleKey: string;
  /** null = access to all temples in the organization */
  readonly templeIds: readonly string[] | null;
}

/**
 * Context for flows that happen before a tenant exists (signup/provisioning)
 * or system jobs. Deliberately a distinct type so tenant-scoped repositories
 * cannot accept it by accident.
 */
export interface SystemContext {
  readonly kind: 'system';
  /** Why this cross-tenant/system access is happening — written to audit logs. */
  readonly reason: string;
  readonly actorUserId?: string;
}

export function systemContext(reason: string, actorUserId?: string): SystemContext {
  return { kind: 'system', reason, actorUserId };
}
