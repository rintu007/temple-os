'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { devoteeService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function devoteeInputFromForm(formData: FormData) {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  return {
    fullName: field('fullName'),
    email: field('email'),
    phone: field('phone'),
    gender: field('gender'),
    dateOfBirth: field('dateOfBirth'),
    addressLine1: field('addressLine1'),
    city: field('city'),
    state: field('state'),
    postalCode: field('postalCode'),
    notes: field('notes'),
    familyName: field('familyName'),
  };
}

export async function createDevoteeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await devoteeService().createDevotee(ctx, devoteeInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/devotees');
  redirect('/devotees');
}

export async function updateDevoteeAction(
  devoteeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await devoteeService().updateDevotee(
    ctx,
    devoteeId,
    devoteeInputFromForm(formData),
  );
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/devotees/${devoteeId}`);
  revalidatePath('/devotees');
  return { message: 'Saved' };
}

export async function archiveDevoteeAction(devoteeId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await devoteeService().archiveDevotee(ctx, devoteeId);
  revalidatePath('/devotees');
  redirect('/devotees');
}
