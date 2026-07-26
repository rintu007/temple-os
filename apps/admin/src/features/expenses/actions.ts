'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { expenseService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function recordExpenseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };

  const result = await expenseService().recordExpense(ctx, {
    amount: field('amount'),
    method: field('method'),
    paidTo: field('paidTo'),
    categoryName: field('categoryName'),
    fundId: field('fundId'),
    accountId: field('accountId'),
    employeeId: field('employeeId'),
    grantId: field('grantId'),
    reference: field('reference'),
    note: field('note'),
    spentOn: field('spentOn'),
  });

  if (!result.ok) return { error: result.error.message };

  revalidatePath('/expenses');
  revalidatePath('/');
  redirect(`/expenses/${result.value.id}`);
}

export async function voidExpenseAction(
  expenseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const reason = formData.get('reason');
  const result = await expenseService().voidExpense(ctx, expenseId, {
    reason: typeof reason === 'string' ? reason : '',
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/expenses/${expenseId}`);
  revalidatePath('/expenses');
  revalidatePath('/');
  return { message: 'Expense voided' };
}

export async function approveExpenseAction(expenseId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await expenseService().approveExpense(ctx, expenseId);
  revalidatePath('/expenses/approvals');
  revalidatePath(`/expenses/${expenseId}`);
  revalidatePath('/expenses');
}

export async function rejectExpenseAction(
  expenseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const reason = formData.get('reason');
  const result = await expenseService().rejectExpense(ctx, expenseId, {
    reason: typeof reason === 'string' ? reason : '',
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/expenses/approvals');
  revalidatePath(`/expenses/${expenseId}`);
  revalidatePath('/expenses');
  return { message: 'Expense rejected' };
}

export async function setApprovalThresholdAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const threshold = formData.get('threshold');
  const result = await expenseService().setApprovalSettings(ctx, {
    threshold: typeof threshold === 'string' ? threshold : '',
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/expenses/approvals');
  revalidatePath('/expenses');
  return { message: 'Approval settings updated' };
}
