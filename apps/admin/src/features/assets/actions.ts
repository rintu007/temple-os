'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { assetService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function assetInputFromForm(formData: FormData) {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const estimatedValue = field('estimatedValue');
  return {
    name: field('name'),
    category: field('category'),
    description: field('description'),
    quantity: field('quantity') || '1',
    estimatedValue: estimatedValue === '' ? undefined : estimatedValue,
    acquiredOn: field('acquiredOn'),
    location: field('location'),
    note: field('note'),
  };
}

export async function createAssetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await assetService().createAsset(ctx, assetInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/assets');
  redirect(`/assets/${result.value.id}`);
}

export async function updateAssetAction(
  assetId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await assetService().updateAsset(ctx, assetId, assetInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/assets');
  revalidatePath(`/assets/${assetId}`);
  return { message: 'Saved' };
}

export async function disposeAssetAction(
  assetId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const reason = formData.get('reason');
  const result = await assetService().disposeAsset(ctx, assetId, {
    reason: typeof reason === 'string' ? reason : '',
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/assets');
  revalidatePath(`/assets/${assetId}`);
  return { message: 'Asset marked disposed' };
}
