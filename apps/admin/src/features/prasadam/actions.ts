'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { prasadamService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function recordPrasadamAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };

  const result = await prasadamService().recordSession(ctx, {
    meal: field('meal'),
    servedOn: field('servedOn'),
    servedCount: field('servedCount'),
    sponsorName: field('sponsorName'),
    sponsorAmount: field('sponsorAmount') || undefined,
    note: field('note'),
  });

  if (!result.ok) return { error: result.error.message };

  revalidatePath('/prasadam');
  revalidatePath('/donations');
  revalidatePath('/');
  redirect('/prasadam');
}
