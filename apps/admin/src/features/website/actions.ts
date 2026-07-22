'use server';

import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/form-state';
import { websiteService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function updateSiteSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };

  const result = await websiteService().updateSettings(ctx, {
    tagline: field('tagline'),
    aboutText: field('aboutText'),
    historyText: field('historyText'),
    contactEmail: field('contactEmail'),
    contactPhone: field('contactPhone'),
    addressText: field('addressText'),
    facebookUrl: field('facebookUrl'),
    instagramUrl: field('instagramUrl'),
    youtubeUrl: field('youtubeUrl'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/website');
  return { message: 'Website content saved — it is live immediately.' };
}

export async function markMessageReadAction(messageId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await websiteService().markMessageRead(ctx, messageId);
  revalidatePath('/website/messages');
}
