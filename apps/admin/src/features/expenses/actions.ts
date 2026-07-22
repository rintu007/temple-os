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
