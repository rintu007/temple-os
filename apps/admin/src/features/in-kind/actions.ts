'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { inKindService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function inKindInput(formData: FormData) {
  return {
    donorName: field(formData, 'donorName'),
    devoteeId: field(formData, 'devoteeId'),
    category: field(formData, 'category'),
    item: field(formData, 'item'),
    quantity: field(formData, 'quantity'),
    unit: field(formData, 'unit'),
    estimatedValue: field(formData, 'estimatedValue'),
    receivedOn: field(formData, 'receivedOn'),
    note: field(formData, 'note'),
  };
}

export async function recordInKindAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext('finance-basic');
  const result = await inKindService().recordInKind(ctx, inKindInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/in-kind');
  redirect(`/in-kind/${result.value.id}`);
}

export async function updateInKindAction(
  inKindId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('finance-basic');
  const result = await inKindService().updateInKind(ctx, inKindId, inKindInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/in-kind');
  revalidatePath(`/in-kind/${inKindId}`);
  return { message: 'Saved' };
}

export async function setDispositionAction(
  inKindId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('finance-basic');
  const result = await inKindService().setDisposition(ctx, inKindId, {
    disposition: field(formData, 'disposition'),
    disposalNote: field(formData, 'disposalNote'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/in-kind');
  revalidatePath(`/in-kind/${inKindId}`);
  return { message: 'Disposition updated' };
}
