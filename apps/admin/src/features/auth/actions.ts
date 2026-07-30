'use server';

import { redirect } from 'next/navigation';
import {
  requestPasswordResetSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from '@templeos/validators';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/lib/form-state';

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { fullName, email, password } = parsed.data;

  const rawNext = formData.get('next');
  const next =
    typeof rawNext === 'string' && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/onboarding';

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    return { error: error.message };
  }
  if (!data.session) {
    return {
      message: 'Almost there — check your inbox and click the confirmation link to continue.',
    };
  }
  redirect(next);
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const rawNext = formData.get('next');
  const next =
    typeof rawNext === 'string' && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/';

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.message };
  }
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/**
 * Always returns the same message regardless of whether the address has an
 * account — resetPasswordForEmail itself doesn't leak existence either, and
 * this action must not either, to avoid turning "forgot password" into an
 * account-enumeration oracle.
 */
export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
  });

  return { message: "If that email has an account, we've sent a reset link to it." };
}

/**
 * Only reachable with the temporary session Supabase issues after the
 * recovery link's code exchange (apps/admin/src/app/auth/callback) — there
 * is no separate "current password" check because that temporary session
 * itself is the proof of email ownership.
 */
export async function updatePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  redirect('/');
}
