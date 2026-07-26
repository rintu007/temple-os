'use server';

import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/form-state';
import { budgetService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function setBudgetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };

  const result = await budgetService().setBudget(ctx, {
    financialYear: field('financialYear'),
    kind: field('kind'),
    category: field('category'),
    amount: field('amount'),
    note: field('note'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/budgets');
  return { message: 'Budget saved' };
}

export async function removeBudgetAction(budgetId: string, fy: number): Promise<void> {
  const { ctx } = await requireTenantContext();
  await budgetService().removeBudget(ctx, budgetId);
  revalidatePath('/budgets');
  void fy;
}
