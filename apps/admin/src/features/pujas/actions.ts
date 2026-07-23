'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { pujaService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function typeInputFromForm(formData: FormData) {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  return {
    name: field('name'),
    description: field('description'),
    price: field('price'),
    isActive: formData.get('isActive') === 'on',
  };
}

export async function createPujaTypeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await pujaService().createPujaType(ctx, typeInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/pujas');
  redirect('/pujas');
}

export async function updatePujaTypeAction(
  typeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await pujaService().updatePujaType(ctx, typeId, typeInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/pujas/${typeId}`);
  revalidatePath('/pujas');
  return { message: 'Saved' };
}

export async function deletePujaTypeAction(typeId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await pujaService().deletePujaType(ctx, typeId);
  revalidatePath('/pujas');
  redirect('/pujas');
}

export async function completeBookingAction(bookingId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await pujaService().markBookingCompleted(ctx, bookingId);
  revalidatePath('/pujas/bookings');
}

export async function cancelBookingAction(bookingId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await pujaService().cancelBooking(ctx, bookingId);
  revalidatePath('/pujas/bookings');
}

// ---- Seva scheduling ----

export async function addPriestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const result = await pujaService().createPriest(ctx, {
    name: field('name'),
    phone: field('phone'),
    specialty: field('specialty'),
    isActive: true,
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/pujas/priests');
  return { message: 'Priest added' };
}

export async function togglePriestAction(priestId: string, isActive: boolean): Promise<void> {
  const { ctx } = await requireTenantContext();
  await pujaService().setPriestActive(ctx, priestId, isActive);
  revalidatePath('/pujas/priests');
}

export async function assignSevaAction(
  bookingId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const result = await pujaService().assignSeva(ctx, bookingId, {
    priestId: field('priestId'),
    scheduledOn: field('scheduledOn'),
    scheduledTime: field('scheduledTime'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/pujas/bookings');
  revalidatePath('/pujas/schedule');
  return { message: 'Saved' };
}
