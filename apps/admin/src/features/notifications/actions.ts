'use server';

import { revalidatePath } from 'next/cache';
import { notificationService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function markNotificationsReadAction(): Promise<void> {
  const { ctx } = await requireTenantContext();
  await notificationService().markRead(ctx);
  revalidatePath('/', 'layout');
}
