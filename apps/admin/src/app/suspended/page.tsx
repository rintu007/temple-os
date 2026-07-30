import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Button } from '@templeos/ui';
import { signOutAction } from '@/features/auth/actions';
import { getActiveMembership, requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Account suspended' };

export default async function SuspendedPage() {
  const user = await requireUser();
  const membership = await getActiveMembership(user.id);
  if (membership && membership.organizationStatus !== 'suspended') {
    // No longer suspended (or was never) — nothing to show here.
    redirect('/');
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <span className="text-lg font-semibold tracking-tight">
            Temple<span className="text-primary">OS</span>
          </span>
        </div>
        <div className="rounded-xl border border-border bg-background p-8 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">Account suspended</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {membership?.organizationName ?? 'Your organization'}&apos;s TempleOS account has been
            suspended. Your temple&apos;s public website and donation intake are unaffected — this
            only blocks staff access to the admin dashboard.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Contact TempleOS support to resolve this.
          </p>
          <form action={signOutAction} className="mt-6">
            <Button variant="outline" type="submit" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
