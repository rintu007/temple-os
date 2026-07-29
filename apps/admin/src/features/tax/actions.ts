'use server';

import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/form-state';
import { taxService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function saveTaxProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };

  const result = await taxService().saveProfile(ctx, {
    legalName: field('legalName'),
    pan: field('pan'),
    registrationNumber: field('registrationNumber'),
    validFrom: field('validFrom'),
    validUntil: field('validUntil'),
    showOnReceipt: formData.get('showOnReceipt') === 'on',
  });

  if (!result.ok) return { error: result.error.message };
  revalidatePath('/tax');
  return { message: '80G profile saved' };
}
