'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { volunteerService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function createOpportunityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const result = await volunteerService().createOpportunity(ctx, {
    title: field('title'),
    description: field('description'),
    servingOn: field('servingOn'),
    slotsNeeded: field('slotsNeeded') || '0',
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/volunteers');
  redirect(`/volunteers/${result.value.id}`);
}

export async function setOpportunityStatusAction(
  opportunityId: string,
  status: 'open' | 'closed',
): Promise<void> {
  const { ctx } = await requireTenantContext();
  await volunteerService().setOpportunityStatus(ctx, opportunityId, status);
  revalidatePath('/volunteers');
  revalidatePath(`/volunteers/${opportunityId}`);
}
