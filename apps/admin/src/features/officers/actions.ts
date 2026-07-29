'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { officerService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function officerInputFromForm(formData: FormData) {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  return {
    name: field('name'),
    designation: field('designation'),
    body: field('body'),
    phone: field('phone'),
    email: field('email'),
    termStartsOn: field('termStartsOn'),
    termEndsOn: field('termEndsOn'),
    note: field('note'),
  };
}

export async function createOfficerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('community');
  const result = await officerService().createOfficer(ctx, officerInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/officers');
  redirect('/officers');
}

export async function updateOfficerAction(
  officerId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('community');
  const result = await officerService().updateOfficer(ctx, officerId, officerInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/officers');
  revalidatePath(`/officers/${officerId}`);
  return { message: 'Saved' };
}

export async function setOfficerActiveAction(
  officerId: string,
  isActive: boolean,
): Promise<void> {
  const { ctx } = await requireTenantContext('community');
  await officerService().setOfficerActive(ctx, officerId, isActive);
  revalidatePath('/officers');
  revalidatePath(`/officers/${officerId}`);
}
