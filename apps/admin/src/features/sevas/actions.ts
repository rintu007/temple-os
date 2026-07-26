'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { donationService, sevaService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function sevaInput(formData: FormData) {
  return {
    sponsorName: field(formData, 'sponsorName'),
    devoteeId: field(formData, 'devoteeId'),
    sevaName: field(formData, 'sevaName'),
    amount: field(formData, 'amount'),
    frequency: field(formData, 'frequency'),
    occasion: field(formData, 'occasion'),
    startDate: field(formData, 'startDate'),
    endDate: field(formData, 'endDate'),
    note: field(formData, 'note'),
  };
}

export async function createSevaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await sevaService().createSeva(ctx, sevaInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/sevas');
  redirect(`/sevas/${result.value.id}`);
}

export async function updateSevaAction(
  sevaId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await sevaService().updateSeva(ctx, sevaId, sevaInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/sevas');
  revalidatePath(`/sevas/${sevaId}`);
  return { message: 'Saved' };
}

export async function setSevaStatusAction(
  sevaId: string,
  status: 'active' | 'paused' | 'ended',
): Promise<void> {
  const { ctx } = await requireTenantContext();
  await sevaService().setSevaStatus(ctx, sevaId, status);
  revalidatePath('/sevas');
  revalidatePath(`/sevas/${sevaId}`);
}

/** Record a payment against a seva — it joins the donation ledger, tagged to the seva. */
export async function recordSevaPaymentAction(
  sevaId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const detail = await sevaService().getSevaDetail(ctx, sevaId);
  if (!detail.ok) return { error: detail.error.message };
  const { seva } = detail.value;

  const amountField = field(formData, 'amount');
  const result = await donationService().recordDonation(ctx, {
    donorName: seva.sponsorName,
    devoteeId: seva.devoteeId ?? '',
    amount: amountField || seva.amount,
    method: field(formData, 'method') || 'cash',
    categoryName: 'Seva',
    sevaSubscriptionId: sevaId,
    donatedOn: field(formData, 'donatedOn'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/sevas/${sevaId}`);
  revalidatePath('/sevas');
  revalidatePath('/donations');
  return { message: `Payment recorded — receipt ${result.value.receiptNumber}` };
}
