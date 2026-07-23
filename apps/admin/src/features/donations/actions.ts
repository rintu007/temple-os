'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { renderDonationReceiptEmail, sendEmail } from '@templeos/email';
import type { FormState } from '@/lib/form-state';
import { donationService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function recordDonationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx, membership } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };

  const email = field('email');
  const result = await donationService().recordDonation(ctx, {
    amount: field('amount'),
    method: field('method'),
    devoteeId: field('devoteeId'),
    donorName: field('donorName'),
    categoryName: field('categoryName'),
    campaignId: field('campaignId'),
    reference: field('reference'),
    note: field('note'),
    donatedOn: field('donatedOn'),
  });

  if (!result.ok) return { error: result.error.message };

  if (email) {
    const { subject, html } = renderDonationReceiptEmail({
      organizationName: membership.organizationName,
      donorName: result.value.donorName,
      amount: result.value.amount,
      currency: result.value.currency,
      receiptNumber: result.value.receiptNumber,
      donatedAt: result.value.donatedAt,
      categoryName: result.value.categoryName,
    });
    // Best-effort: the donation is already recorded regardless of email outcome.
    await sendEmail({ to: email, subject, html });
  }

  revalidatePath('/donations');
  revalidatePath('/');
  redirect(`/donations/${result.value.id}`);
}

export async function voidDonationAction(
  donationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const reason = formData.get('reason');
  const result = await donationService().voidDonation(ctx, donationId, {
    reason: typeof reason === 'string' ? reason : '',
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/donations/${donationId}`);
  revalidatePath('/donations');
  revalidatePath('/');
  return { message: 'Donation voided' };
}
