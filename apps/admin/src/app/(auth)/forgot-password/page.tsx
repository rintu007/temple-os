import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-raised">
      <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
