'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { meetingService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function meetingInputFromForm(formData: FormData) {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  return {
    title: field('title'),
    body: field('body'),
    meetingOn: field('meetingOn'),
    location: field('location'),
    attendees: field('attendees'),
    agenda: field('agenda'),
    minutes: field('minutes'),
    decisions: field('decisions'),
    status: field('status') || 'scheduled',
  };
}

export async function createMeetingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await meetingService().createMeeting(ctx, meetingInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/meetings');
  redirect(`/meetings/${result.value.id}`);
}

export async function updateMeetingAction(
  meetingId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await meetingService().updateMeeting(ctx, meetingId, meetingInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/meetings');
  revalidatePath(`/meetings/${meetingId}`);
  return { message: 'Saved' };
}
