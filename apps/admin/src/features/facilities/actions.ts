'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { facilityService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function createFacilityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const result = await facilityService().createFacility(ctx, {
    name: field('name'),
    description: field('description'),
    capacity: field('capacity'),
    rentAmount: field('rentAmount'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/facilities');
  redirect('/facilities');
}

export async function toggleFacilityAction(facilityId: string, isActive: boolean): Promise<void> {
  const { ctx } = await requireTenantContext();
  await facilityService().setFacilityActive(ctx, facilityId, isActive);
  revalidatePath('/facilities');
}

export async function confirmBookingAction(
  bookingId: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await facilityService().confirmBooking(ctx, bookingId);
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/facilities/bookings');
  return { message: 'Booking confirmed' };
}

export async function cancelFacilityBookingAction(bookingId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await facilityService().cancelBooking(ctx, bookingId);
  revalidatePath('/facilities/bookings');
}
