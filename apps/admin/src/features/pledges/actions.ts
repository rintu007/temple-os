'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { pledgeService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

export async function createPledgeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await pledgeService().createPledge(ctx, {
    donorName: field(formData, 'donorName'),
    devoteeId: field(formData, 'devoteeId'),
    campaignId: field(formData, 'campaignId'),
    amount: field(formData, 'amount'),
    pledgedOn: field(formData, 'pledgedOn'),
    dueDate: field(formData, 'dueDate'),
    note: field(formData, 'note'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/pledges');
  redirect(`/pledges/${result.value.id}`);
}

export async function fulfilPledgeAction(
  pledgeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await pledgeService().fulfilPledge(ctx, pledgeId, {
    amount: field(formData, 'amount'),
    method: field(formData, 'method'),
    receivedOn: field(formData, 'receivedOn'),
    reference: field(formData, 'reference'),
    note: field(formData, 'note'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/pledges/${pledgeId}`);
  revalidatePath('/pledges');
  revalidatePath('/donations');
  return { message: `Receipt ${result.value.receiptNumber} recorded` };
}

export async function cancelPledgeAction(pledgeId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await pledgeService().cancelPledge(ctx, pledgeId, { reason: 'Cancelled from pledge register' });
  revalidatePath(`/pledges/${pledgeId}`);
  revalidatePath('/pledges');
}
