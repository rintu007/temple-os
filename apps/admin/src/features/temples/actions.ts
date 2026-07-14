'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { templeService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function templeInputFromForm(formData: FormData) {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  return {
    name: field('name'),
    deity: field('deity'),
    addressLine1: field('addressLine1'),
    addressLine2: field('addressLine2'),
    city: field('city'),
    state: field('state'),
    postalCode: field('postalCode'),
    phone: field('phone'),
    email: field('email'),
  };
}

export async function createTempleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await templeService().createTemple(ctx, templeInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/temples');
  redirect(`/temples/${result.value.id}`);
}

export async function updateTempleAction(
  templeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await templeService().updateTemple(ctx, templeId, templeInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/temples/${templeId}`);
  revalidatePath('/temples');
  return { message: 'Saved' };
}

export async function addScheduleItemAction(
  templeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const result = await templeService().addScheduleItem(ctx, templeId, {
    title: field('title'),
    startTime: field('startTime'),
    endTime: field('endTime'),
    description: field('description'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/temples/${templeId}`);
  return {};
}

export async function removeScheduleItemAction(templeId: string, itemId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await templeService().removeScheduleItem(ctx, itemId);
  revalidatePath(`/temples/${templeId}`);
}
