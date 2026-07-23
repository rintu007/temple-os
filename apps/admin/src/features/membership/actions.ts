'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { membershipService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function planInputFromForm(formData: FormData) {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  return {
    name: field('name'),
    description: field('description'),
    price: field('price'),
    durationMonths: field('durationMonths'),
    isActive: formData.get('isActive') === 'on',
  };
}

export async function createPlanAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await membershipService().createPlan(ctx, planInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/membership');
  redirect('/membership');
}

export async function updatePlanAction(
  planId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await membershipService().updatePlan(ctx, planId, planInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/membership/${planId}`);
  revalidatePath('/membership');
  return { message: 'Saved' };
}

export async function deletePlanAction(planId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await membershipService().deletePlan(ctx, planId);
  revalidatePath('/membership');
  redirect('/membership');
}

export async function cancelMembershipAction(subscriptionId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await membershipService().cancelMembership(ctx, subscriptionId);
  revalidatePath('/membership/members');
}

export async function renewMembershipAction(
  subscriptionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };

  const result = await membershipService().renewMembership(ctx, subscriptionId, {
    method: field('method'),
    amount: field('amount') || undefined,
    reference: field('reference'),
  });
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/membership/renewals');
  revalidatePath('/membership/members');
  revalidatePath('/donations');
  revalidatePath('/');
  return {
    message: `Renewed — receipt ${result.value.receiptNumber}, valid to ${result.value.subscription.expiresOn ?? ''}`,
  };
}
