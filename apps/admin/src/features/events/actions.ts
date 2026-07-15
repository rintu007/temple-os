'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { eventService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function eventInputFromForm(formData: FormData) {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  return {
    title: field('title'),
    kind: field('kind'),
    description: field('description'),
    location: field('location'),
    date: field('date'),
    startTime: field('startTime'),
    endDate: field('endDate'),
    endTime: field('endTime'),
    isPublished: formData.get('isPublished') === 'on',
  };
}

export async function createEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await eventService().createEvent(ctx, eventInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/events');
  redirect('/events');
}

export async function updateEventAction(
  eventId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await eventService().updateEvent(ctx, eventId, eventInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
  return { message: 'Saved' };
}

export async function deleteEventAction(eventId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await eventService().deleteEvent(ctx, eventId);
  revalidatePath('/events');
  redirect('/events');
}
