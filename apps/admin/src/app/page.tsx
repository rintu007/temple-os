import { redirect } from 'next/navigation';
import { Button } from '@templeos/ui';
import { signOutAction } from '@/features/auth/actions';
import { getActiveMembership, requireUser } from '@/lib/session';

function siteUrl(slug: string): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  return process.env.NODE_ENV === 'production'
    ? `https://${slug}.${root}`
    : `http://${slug}.${root}:3001`;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const membership = await getActiveMembership(user.id);
  if (!membership) redirect('/onboarding');

  const publicUrl = siteUrl(membership.organizationSlug);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-tight">
              Temple<span className="text-primary">OS</span>
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">{membership.organizationName}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <form action={signOutAction}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {membership.organizationName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your temple is live on TempleOS. Here&apos;s where things stand.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-border p-6">
            <h2 className="text-sm font-medium text-muted-foreground">Organization</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{membership.organizationName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Your role</dt>
                <dd className="font-medium capitalize">{membership.roleName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Country</dt>
                <dd className="font-medium">
                  {membership.country === 'IN' ? 'India' : 'Bangladesh'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Currency</dt>
                <dd className="font-medium">{membership.currency}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-border p-6">
            <h2 className="text-sm font-medium text-muted-foreground">Public website</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Your temple&apos;s website is being prepared at
            </p>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all font-medium text-primary hover:underline"
            >
              {publicUrl}
            </a>
            <p className="mt-4 text-xs text-muted-foreground">
              Pages, themes and content management arrive in the next milestone.
            </p>
          </section>
        </div>

        <section className="rounded-xl border border-border p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Coming next</h2>
          <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li>• Temple profile &amp; daily schedule</li>
            <li>• Devotee directory &amp; families</li>
            <li>• Donations &amp; receipts</li>
            <li>• Events &amp; festival calendar</li>
            <li>• Website content &amp; themes</li>
            <li>• Staff invitations &amp; roles</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
