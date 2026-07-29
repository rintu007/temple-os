'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { accountService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function accountInput(formData: FormData) {
  return {
    name: field(formData, 'name'),
    type: field(formData, 'type'),
    bankName: field(formData, 'bankName'),
    accountNumber: field(formData, 'accountNumber'),
    openingBalance: field(formData, 'openingBalance'),
    openingDate: field(formData, 'openingDate'),
    note: field(formData, 'note'),
  };
}

export async function createAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await accountService().createAccount(ctx, accountInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/accounts');
  redirect(`/accounts/${result.value.id}`);
}

export async function updateAccountAction(
  accountId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await accountService().updateAccount(ctx, accountId, accountInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/accounts');
  revalidatePath(`/accounts/${accountId}`);
  return { message: 'Saved' };
}

export async function setAccountActiveAction(accountId: string, isActive: boolean): Promise<void> {
  const { ctx } = await requireTenantContext('accounting');
  await accountService().setAccountActive(ctx, accountId, isActive);
  revalidatePath('/accounts');
  revalidatePath(`/accounts/${accountId}`);
}
