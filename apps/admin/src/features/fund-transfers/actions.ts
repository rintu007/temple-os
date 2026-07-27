'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { fundTransferService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

export async function createFundTransferAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await fundTransferService().createTransfer(ctx, {
    fromFundId: field(formData, 'fromFundId'),
    toFundId: field(formData, 'toFundId'),
    amount: field(formData, 'amount'),
    transferredOn: field(formData, 'transferredOn'),
    reference: field(formData, 'reference'),
    note: field(formData, 'note'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/funds/transfers');
  revalidatePath('/funds');
  redirect('/funds/transfers');
}
