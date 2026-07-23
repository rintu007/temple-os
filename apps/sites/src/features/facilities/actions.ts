'use server';

import { facilityService } from '@/lib/services';

export interface FacilityRequestState {
  ok?: boolean;
  error?: string;
  facilityName?: string;
}

export async function requestBookingAction(
  organizationId: string,
  _prev: FacilityRequestState,
  formData: FormData,
): Promise<FacilityRequestState> {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const result = await facilityService().requestBooking(organizationId, {
    facilityId: field('facilityId'),
    bookerName: field('bookerName'),
    phone: field('phone'),
    email: field('email'),
    eventDate: field('eventDate'),
    purpose: field('purpose'),
    note: field('note'),
  });
  if (!result.ok) return { error: result.error.message };
  return { ok: true, facilityName: result.value.facilityName };
}
