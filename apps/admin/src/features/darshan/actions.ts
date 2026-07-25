'use server';

import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/form-state';
import { darshanService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function createSlotAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };

  const result = await darshanService().createSlot(ctx, {
    name: field('name'),
    slotDate: field('slotDate'),
    startTime: field('startTime'),
    endTime: field('endTime'),
    capacity: field('capacity'),
    note: field('note'),
  });
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/darshan');
  return { message: `Slot “${result.value.name}” created` };
}

export async function toggleSlotActiveAction(
  slotId: string,
  isActive: boolean,
): Promise<void> {
  const { ctx } = await requireTenantContext();
  await darshanService().setSlotActive(ctx, slotId, isActive);
  revalidatePath('/darshan');
  revalidatePath(`/darshan/${slotId}`);
}

export async function markTokenUsedAction(slotId: string, tokenId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await darshanService().markTokenUsed(ctx, tokenId);
  revalidatePath(`/darshan/${slotId}`);
}

export async function cancelTokenAction(slotId: string, tokenId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await darshanService().cancelToken(ctx, tokenId);
  revalidatePath(`/darshan/${slotId}`);
}
