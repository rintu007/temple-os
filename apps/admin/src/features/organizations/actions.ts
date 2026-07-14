'use server';

import { redirect } from 'next/navigation';
import { systemContext } from '@templeos/core';
import type { FormState } from '@/lib/form-state';
import { organizationService } from '@/lib/services';
import { requireUser } from '@/lib/session';

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
