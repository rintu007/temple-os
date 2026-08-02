'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { changelogService } from '@/lib/services';
import { requirePlatformAdmin, requireUser } from '@/lib/session';
import type { FormState } from '@/lib/form-state';

export async function markChangelogReadAction(): Promise<void> {
  const user = await requireUser();
  await changelogService().markRead(user.id);
  revalidatePath('/', 'layout');
}

export async function createChangelogEntryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requirePlatformAdmin();
  const result = await changelogService().createEntry(user.id, {
    title: formData.get('title'),
    body: formData.get('body'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/platform/changelog');
  revalidatePath('/', 'layout');
  redirect('/platform/changelog');
}

export async function deleteChangelogEntryAction(
  id: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const { user } = await requirePlatformAdmin();
  const result = await changelogService().deleteEntry(user.id, id);
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/platform/changelog');
  revalidatePath('/', 'layout');
  redirect('/platform/changelog');
}
