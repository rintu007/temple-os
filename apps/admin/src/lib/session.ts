import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { User } from '@templeos/auth';
import type { MembershipSummary, TenantContext } from '@templeos/core';
import type { ModuleKey } from '@templeos/validators';
import { createClient } from './supabase/server';
import { billingService, organizationService, platformService, roleService } from './services';

/** Which of a multi-org user's memberships is active — read here, written by switchOrganizationAction. */
export const ACTIVE_ORG_COOKIE = 'templeos_active_org';

/** Verified session user (validated against Supabase, deduped per request). */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * The user's active organization membership. Most users belong to one org
 * (falls back to the oldest); a user in several picks via the ACTIVE_ORG_COOKIE
 * (set by switchOrganizationAction) — self-healing if that org is no longer
 * one of theirs (removed, or the row just isn't 'active' anymore).
 */
export const getActiveMembership = cache(
  async (userId: string): Promise<MembershipSummary | null> => {
    const memberships = await organizationService().listUserMemberships(userId);
    if (memberships.length === 0) return null;
    if (memberships.length === 1) return memberships[0]!;

    const cookieStore = await cookies();
    const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
    return memberships.find((m) => m.organizationId === activeOrgId) ?? memberships[0]!;
  },
);

export interface SessionWithTenant {
  user: User;
  membership: MembershipSummary;
  ctx: TenantContext;
  /** 'all' covers legacy orgs with no subscription row and an active, unexpired trial. */
  entitledModules: 'all' | ReadonlySet<ModuleKey>;
}

/**
 * Auth + tenant guard for dashboard pages. Redirects when either is missing.
 * Pass `requiredModule` for a page that belongs to a gateable module
 * (packages/validators/src/billing.ts#ModuleKey) — the visitor is bounced to
 * /billing if their plan doesn't include it. Core pages (dashboard, devotees,
 * donations, events, temples, team, activity, website, billing itself) pass
 * nothing, since they're included on every plan.
 */
export async function requireTenantContext(requiredModule?: ModuleKey): Promise<SessionWithTenant> {
  const user = await requireUser();
  const membership = await getActiveMembership(user.id);
  if (!membership) redirect('/onboarding');
  // Platform-admin action (packages/core/src/features/platform), not a billing
  // lapse — deliberately does not touch the org's public donor-facing site.
  if (membership.organizationStatus === 'suspended') redirect('/suspended');
  // null for the 5 system roles — authorize() falls back to its static map.
  // Only a custom role costs an extra query, and only once per request.
  const permissions = await roleService().resolvePermissions(
    membership.organizationId,
    membership.roleKey,
  );
  const ctx: TenantContext = {
    organizationId: membership.organizationId,
    userId: user.id,
    roleKey: membership.roleKey,
    templeIds: null,
    permissions: permissions ?? undefined,
  };

  const entitledModules = await billingService().getEntitledModules(ctx);
  if (requiredModule && entitledModules !== 'all' && !entitledModules.has(requiredModule)) {
    redirect(`/billing?locked=${requiredModule}`);
  }

  return { user, membership, ctx, entitledModules };
}

/** Whether the signed-in user is TempleOS staff, not any tenant's staff — see packages/db/sql/0004. */
export async function checkIsPlatformAdmin(userId: string): Promise<boolean> {
  return platformService().isPlatformAdmin(userId);
}

/**
 * Guard for the cross-tenant /platform section. Deliberately separate from
 * requireTenantContext — a platform admin may or may not also belong to a
 * temple's org, and this check is completely independent of that.
 */
export async function requirePlatformAdmin(): Promise<{ user: User }> {
  const user = await requireUser();
  const isAdmin = await checkIsPlatformAdmin(user.id);
  if (!isAdmin) redirect('/');
  return { user };
}
