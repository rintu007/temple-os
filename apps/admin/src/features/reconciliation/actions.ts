'use server';

import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/form-state';
import { reconciliationService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function toggleClearedAction(
  accountId: string,
  kind: 'receipt' | 'payment',
  entryId: string,
  cleared: boolean,
): Promise<void> {
  const { ctx } = await requireTenantContext();
  await reconciliationService().setCleared(ctx, { kind, entryId, cleared });
  revalidatePath(`/accounts/${accountId}/reconcile`);
}

export async function recordReconciliationAction(
  accountId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };

  const result = await reconciliationService().recordReconciliation(ctx, accountId, {
    statementDate: field('statementDate'),
    statementBalance: field('statementBalance'),
    note: field('note'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/accounts/${accountId}/reconcile`);
  revalidatePath(`/accounts/${accountId}`);
  const diff = Number(result.value.difference);
  return {
    message:
      diff === 0
        ? 'Reconciled — the cleared balance matches the statement.'
        : `Recorded with a difference of ${result.value.difference}. Review uncleared items.`,
  };
}
