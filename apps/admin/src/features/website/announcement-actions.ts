'use server';

import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/form-state';
import { websiteService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function createAnnouncementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const result = await websiteService().createAnnouncement(ctx, {
    title: field('title'),
    body: field('body'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/website/announcements');
  return { message: 'Announcement created as draft' };
}

export async function setAnnouncementStatusAction(
  announcementId: string,
  status: 'draft' | 'published',
): Promise<void> {
  const { ctx } = await requireTenantContext();
  await websiteService().setAnnouncementStatus(ctx, announcementId, status);
  revalidatePath('/website/announcements');
}

export async function deleteAnnouncementAction(announcementId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await websiteService().deleteAnnouncement(ctx, announcementId);
  revalidatePath('/website/announcements');
}
