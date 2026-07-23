'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { hundiService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function recordHundiCollectionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };

  // Denomination inputs are named `denom_<value>`; keep only positive counts.
  const denominations: { value: number; count: number }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith('denom_') || typeof raw !== 'string') continue;
    const value = Number.parseInt(key.slice('denom_'.length), 10);
    const count = Number.parseInt(raw, 10);
    if (Number.isFinite(value) && Number.isFinite(count) && count > 0) {
      denominations.push({ value, count });
    }
  }

  const amount = field('amount');
  const result = await hundiService().recordCollection(ctx, {
    boxName: field('boxName'),
    countedOn: field('countedOn'),
    note: field('note'),
    denominations: denominations.length > 0 ? denominations : undefined,
    amount: amount === '' ? undefined : amount,
  });

  if (!result.ok) return { error: result.error.message };

  revalidatePath('/hundi');
  revalidatePath('/donations');
  revalidatePath('/');
  redirect('/hundi');
}
