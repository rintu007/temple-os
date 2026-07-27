'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { transferService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

export async function createTransferAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await transferService().createTransfer(ctx, {
    fromAccountId: field(formData, 'fromAccountId'),
    toAccountId: field(formData, 'toAccountId'),
    amount: field(formData, 'amount'),
    transferredOn: field(formData, 'transferredOn'),
    reference: field(formData, 'reference'),
    note: field(formData, 'note'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/transfers');
  revalidatePath('/accounts');
  redirect('/transfers');
}
