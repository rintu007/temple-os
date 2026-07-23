'use server';

import { volunteerService } from '@/lib/services';

export interface VolunteerSignupState {
  ok?: boolean;
  error?: string;
  name?: string;
}

export async function signUpAction(
  organizationId: string,
  _prev: VolunteerSignupState,
  formData: FormData,
): Promise<VolunteerSignupState> {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const result = await volunteerService().signUp(organizationId, {
    opportunityId: field('opportunityId'),
    name: field('name'),
    phone: field('phone'),
    email: field('email'),
    note: field('note'),
  });
  if (!result.ok) return { error: result.error.message };
  return { ok: true, name: result.value.name };
}
