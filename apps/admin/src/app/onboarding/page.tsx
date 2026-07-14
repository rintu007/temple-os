import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CreateOrgForm } from '@/features/organizations/components/create-org-form';
import { getActiveMembership, requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Set up your temple' };

export default async function OnboardingPage() {
  const user = await requireUser();
  const membership = await getActiveMembership(user.id);
  if (membership) redirect('/');

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="text-lg font-semibold tracking-tight">
            Temple<span className="text-primary">OS</span>
          </span>
        </div>
        <div className="rounded-xl border border-border bg-background p-8 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">Set up your temple</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            This creates your organization, your admin workspace and your temple&apos;s public
            website.
          </p>
          <CreateOrgForm />
        </div>
      </div>
    </main>
  );
}
