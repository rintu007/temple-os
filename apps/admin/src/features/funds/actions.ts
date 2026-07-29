'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { fundService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function fundInput(formData: FormData) {
  return { name: field(formData, 'name'), description: field(formData, 'description') };
}

export async function createFundAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await fundService().createFund(ctx, fundInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/funds');
  redirect(`/funds/${result.value.id}`);
}

export async function updateFundAction(
  fundId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await fundService().updateFund(ctx, fundId, fundInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/funds');
  revalidatePath(`/funds/${fundId}`);
  return { message: 'Saved' };
}

export async function setFundActiveAction(fundId: string, isActive: boolean): Promise<void> {
  const { ctx } = await requireTenantContext('accounting');
  await fundService().setFundActive(ctx, fundId, isActive);
  revalidatePath('/funds');
  revalidatePath(`/funds/${fundId}`);
}
