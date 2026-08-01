import type { Metadata } from 'next';
import {
  EmailForm,
  NameForm,
  PasswordForm,
} from '@/features/profile/components/profile-forms';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Your account' };

export default async function ProfilePage() {
  const user = await requireUser();
  const fullName = user.user_metadata?.full_name;

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your name, sign-in email, and password.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Name</h2>
        <NameForm fullName={typeof fullName === 'string' ? fullName : null} />
      </section>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Email</h2>
        <EmailForm currentEmail={user.email ?? ''} />
      </section>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
