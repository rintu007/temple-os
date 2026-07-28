'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { RecurringDonationStatus } from '@templeos/core';
import type { FormState } from '@/lib/form-state';
import { donationService, recurringDonationService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function recurringInput(formData: FormData) {
  return {
    donorName: field(formData, 'donorName'),
    devoteeId: field(formData, 'devoteeId'),
    amount: field(formData, 'amount'),
    frequency: field(formData, 'frequency'),
    fundId: field(formData, 'fundId'),
    startDate: field(formData, 'startDate'),
    endDate: field(formData, 'endDate'),
    note: field(formData, 'note'),
  };
}

export async function createRecurringDonationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await recurringDonationService().createRecurring(ctx, recurringInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/donations/recurring');
  redirect(`/donations/recurring/${result.value.id}`);
}

export async function updateRecurringDonationAction(
  recurringId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await recurringDonationService().updateRecurring(
    ctx,
    recurringId,
    recurringInput(formData),
  );
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/donations/recurring');
  revalidatePath(`/donations/recurring/${recurringId}`);
  return { message: 'Saved' };
}

export async function setRecurringDonationStatusAction(
  recurringId: string,
  status: RecurringDonationStatus,
): Promise<void> {
  const { ctx } = await requireTenantContext();
  await recurringDonationService().setStatus(ctx, recurringId, status);
  revalidatePath('/donations/recurring');
  revalidatePath(`/donations/recurring/${recurringId}`);
}

/** Record an actual gift against a standing order — writes a donation receipt. */
export async function recordRecurringDonationPaymentAction(
  recurringId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const detail = await recurringDonationService().getDetail(ctx, recurringId);
  if (!detail.ok) return { error: detail.error.message };
  const r = detail.value.recurring;

  const result = await donationService().recordDonation(ctx, {
    donorName: r.donorName,
    devoteeId: r.devoteeId ?? '',
    amount: field(formData, 'amount') || r.amount,
    method: field(formData, 'method') || 'cash',
    fundId: r.fundId ?? '',
    recurringDonationId: recurringId,
    donatedOn: field(formData, 'donatedOn'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/donations/recurring');
  revalidatePath(`/donations/recurring/${recurringId}`);
  revalidatePath('/donations');
  return { message: `Receipt recorded — ${result.value.receiptNumber}` };
}
