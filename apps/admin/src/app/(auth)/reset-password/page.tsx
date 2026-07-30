import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Set a new password' };

export default async function ResetPasswordPage() {
  // Reachable only with the temporary session Supabase issues after the
  // recovery link's code exchange — no session at all means no reset in
  // progress, so bounce to /login same as any other protected page.
  await requireUser();

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-raised">
      <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Choose a new password for your account.
      </p>
      <ResetPasswordForm />
    </div>
  );
}
