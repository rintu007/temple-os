import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { User } from '@templeos/auth';
import type { MembershipSummary } from '@templeos/core';
import { createClient } from './supabase/server';
import { organizationService } from './services';

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
 * The user's active organization membership. Single-org for now; the org
 * switcher (multi-membership) arrives with the JWT claims hook.
 */
export const getActiveMembership = cache(
  async (userId: string): Promise<MembershipSummary | null> => {
    const memberships = await organizationService().listUserMemberships(userId);
    return memberships[0] ?? null;
  },
);
