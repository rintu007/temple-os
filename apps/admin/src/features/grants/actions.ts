'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { grantService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function grantInput(formData: FormData) {
  return {
    funder: field(formData, 'funder'),
    title: field(formData, 'title'),
    reference: field(formData, 'reference'),
    sanctionedAmount: field(formData, 'sanctionedAmount'),
    sanctionedOn: field(formData, 'sanctionedOn'),
    purpose: field(formData, 'purpose'),
    note: field(formData, 'note'),
  };
}

export async function createGrantAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await grantService().createGrant(ctx, grantInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/grants');
  redirect(`/grants/${result.value.id}`);
}

export async function updateGrantAction(
  grantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await grantService().updateGrant(ctx, grantId, grantInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/grants');
  revalidatePath(`/grants/${grantId}`);
  return { message: 'Saved' };
}

export async function setGrantStatusAction(
  grantId: string,
  status: 'active' | 'closed',
): Promise<void> {
  const { ctx } = await requireTenantContext('accounting');
  await grantService().setGrantStatus(ctx, grantId, status);
  revalidatePath('/grants');
  revalidatePath(`/grants/${grantId}`);
}
