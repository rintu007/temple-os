'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { donationService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function recordDonationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };

  const result = await donationService().recordDonation(ctx, {
    amount: field('amount'),
    method: field('method'),
    devoteeId: field('devoteeId'),
    donorName: field('donorName'),
    categoryName: field('categoryName'),
    reference: field('reference'),
    note: field('note'),
    donatedOn: field('donatedOn'),
  });

  if (!result.ok) return { error: result.error.message };
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
