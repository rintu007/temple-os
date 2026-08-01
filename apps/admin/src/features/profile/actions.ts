'use server';

import { revalidatePath } from 'next/cache';
import {
  changeAccountPasswordSchema,
  changeEmailSchema,
  updateProfileSchema,
} from '@templeos/validators';
import type { FormState } from '@/lib/form-state';
import { profileService } from '@/lib/services';
import { requireUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = updateProfileSchema.safeParse({ fullName: formData.get('fullName') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName } });

  const result = await profileService().updateFullName(user.id, parsed.data);
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/profile');
  revalidatePath('/team');
  return { message: 'Name updated.' };
}

/**
 * Supabase sends confirmation to the new address (and, if "secure email
 * change" is on, the old one too) — the change only takes effect once
 * confirmed, at which point apps/admin/src/app/auth/callback syncs the mirror.
 */
export async function changeEmailAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = changeEmailSchema.safeParse({ newEmail: formData.get('newEmail') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email: parsed.data.newEmail });
  if (error) return { error: error.message };

  return {
    message: `Check ${parsed.data.newEmail} for a confirmation link to finish the change.`,
  };
}

/**
 * Requires the current password (re-authenticates with it) rather than
 * trusting the existing session alone — a stolen/left-open session shouldn't
 * be enough to lock the real owner out by itself.
 */
export async function changeAccountPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = changeAccountPasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  if (!user.email) return { error: 'Your account has no email on file.' };

  const supabase = await createClient();
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (reauthError) return { error: 'Current password is incorrect.' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  return { message: 'Password updated.' };
}
