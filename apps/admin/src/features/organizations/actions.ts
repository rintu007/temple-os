'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { systemContext } from '@templeos/core';
import type { FormState } from '@/lib/form-state';
import { organizationService } from '@/lib/services';
import { ACTIVE_ORG_COOKIE, requireUser } from '@/lib/session';

export async function createOrganizationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const fullName = user.user_metadata?.full_name;
  const result = await organizationService().provisionOrganization(
    systemContext('signup: organization onboarding', user.id),
    {
      name: formData.get('name'),
      slug: formData.get('slug'),
      country: formData.get('country'),
    },
    {
      userId: user.id,
      email: user.email ?? '',
      fullName: typeof fullName === 'string' ? fullName : null,
    },
  );

  if (!result.ok) {
    return { error: result.error.message };
  }
  redirect('/');
}

/**
 * Only ever stores an org the caller actually has an active membership in —
 * the form value is untrusted input, and getActiveMembership treats whatever
 * lands in this cookie as the active tenant on every later request.
 */
export async function switchOrganizationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const organizationId = formData.get('organizationId');
  if (typeof organizationId !== 'string' || !organizationId) redirect('/');

  const memberships = await organizationService().listUserMemberships(user.id);
  const allowed = memberships.some((m) => m.organizationId === organizationId);
  if (!allowed) redirect('/');

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect('/');
}
