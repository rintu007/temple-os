'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { RecurringStatus } from '@templeos/core';
import type { FormState } from '@/lib/form-state';
import { expenseService, recurringExpenseService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function recurringInput(formData: FormData) {
  return {
    payee: field(formData, 'payee'),
    description: field(formData, 'description'),
    category: field(formData, 'category'),
    amount: field(formData, 'amount'),
    frequency: field(formData, 'frequency'),
    accountId: field(formData, 'accountId'),
    startDate: field(formData, 'startDate'),
    endDate: field(formData, 'endDate'),
    note: field(formData, 'note'),
  };
}

export async function createRecurringAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await recurringExpenseService().createRecurring(ctx, recurringInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/recurring');
  redirect(`/recurring/${result.value.id}`);
}

export async function updateRecurringAction(
  recurringId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await recurringExpenseService().updateRecurring(
    ctx,
    recurringId,
    recurringInput(formData),
  );
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/recurring');
  revalidatePath(`/recurring/${recurringId}`);
  return { message: 'Saved' };
}

export async function setRecurringStatusAction(
  recurringId: string,
  status: RecurringStatus,
): Promise<void> {
  const { ctx } = await requireTenantContext();
  await recurringExpenseService().setStatus(ctx, recurringId, status);
  revalidatePath('/recurring');
  revalidatePath(`/recurring/${recurringId}`);
}

/** Record an actual payment against a standing order — writes an expense voucher. */
export async function recordPaymentAction(
  recurringId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const detail = await recurringExpenseService().getDetail(ctx, recurringId);
  if (!detail.ok) return { error: detail.error.message };
  const r = detail.value.recurring;

  const result = await expenseService().recordExpense(ctx, {
    paidTo: r.payee,
    amount: field(formData, 'amount'),
    method: field(formData, 'method'),
    categoryName: r.category ?? '',
    accountId: r.accountId ?? '',
    recurringExpenseId: recurringId,
    spentOn: field(formData, 'paidOn'),
    note: r.description ?? '',
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/recurring');
  revalidatePath(`/recurring/${recurringId}`);
  revalidatePath('/expenses');
  return { message: 'Payment recorded as an expense voucher.' };
}
