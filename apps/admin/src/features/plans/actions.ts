'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { planService } from '@/lib/services';
import { requirePlatformAdmin } from '@/lib/session';

function planFields(formData: FormData) {
  const priceUsdRaw = formData.get('priceUsd');
  const seatLimitRaw = formData.get('seatLimit');
  const stripePriceIdRaw = formData.get('stripePriceId');
  return {
    name: formData.get('name'),
    priceUsd:
      typeof priceUsdRaw === 'string' && priceUsdRaw.trim() !== '' ? priceUsdRaw : null,
    seatLimit:
      typeof seatLimitRaw === 'string' && seatLimitRaw.trim() !== '' ? seatLimitRaw : null,
    description: formData.get('description'),
    features: String(formData.get('features') ?? '')
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean),
    modules: formData.getAll('modules'),
    isPurchasable: formData.get('isPurchasable') === 'true',
    stripePriceId:
      typeof stripePriceIdRaw === 'string' && stripePriceIdRaw.trim() !== '' ? stripePriceIdRaw : null,
    isTrialDefault: formData.get('isTrialDefault') === 'true',
    isFallbackDefault: formData.get('isFallbackDefault') === 'true',
    sortOrder: formData.get('sortOrder'),
  };
}

export async function createPlanAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requirePlatformAdmin();
  const result = await planService().createPlan(user.id, {
    key: formData.get('key'),
    ...planFields(formData),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/platform/plans');
  redirect(`/platform/plans/${result.value.key}`);
}

export async function updatePlanAction(
  key: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requirePlatformAdmin();
  const result = await planService().updatePlan(user.id, key, planFields(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/platform/plans');
  revalidatePath(`/platform/plans/${key}`);
  return { message: 'Saved' };
}

export async function deletePlanAction(
  key: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const { user } = await requirePlatformAdmin();
  const result = await planService().deletePlan(user.id, key);
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/platform/plans');
  redirect('/platform/plans');
}
