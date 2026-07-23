'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { campaignService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function createCampaignAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const result = await campaignService().createCampaign(ctx, {
    title: field('title'),
    description: field('description'),
    goalAmount: field('goalAmount'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/campaigns');
  redirect(`/campaigns/${result.value.id}`);
}

export async function setCampaignStatusAction(
  campaignId: string,
  status: 'active' | 'completed' | 'archived',
): Promise<void> {
  const { ctx } = await requireTenantContext();
  await campaignService().setCampaignStatus(ctx, campaignId, status);
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
}
