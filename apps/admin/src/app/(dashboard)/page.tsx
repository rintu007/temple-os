import Link from 'next/link';
import { requireTenantContext } from '@/lib/session';
import { templeService } from '@/lib/services';

function siteUrl(slug: string): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  return process.env.NODE_ENV === 'production'
    ? `https://${slug}.${root}`
    : `http://${slug}.${root}:3001`;
}

export default async function DashboardPage() {
  const { membership, ctx } = await requireTenantContext();
  const temples = await templeService().listTemples(ctx);
  const templeCount = temples.ok ? temples.value.length : 0;
  const publicUrl = siteUrl(membership.organizationSlug);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {membership.organizationName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your temple is live on TempleOS. Here&apos;s where things stand.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-border p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Organization</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Your role</dt>
              <dd className="font-medium capitalize">{membership.roleName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Country</dt>
              <dd className="font-medium">{membership.country === 'IN' ? 'India' : 'Bangladesh'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="font-medium">{membership.currency}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-border p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Temples</h2>
          <p className="mt-4 text-3xl font-semibold">{templeCount}</p>
          <Link
            href={templeCount === 0 ? '/temples/new' : '/temples'}
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            {templeCount === 0 ? 'Add your first temple →' : 'Manage temples →'}
          </Link>
        </section>

        <section className="rounded-xl border border-border p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Public website</h2>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block break-all text-sm font-medium text-primary hover:underline"
          >
            {publicUrl}
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            Your temples and daily schedules appear here automatically.
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-border p-6">
        <h2 className="text-sm font-medium text-muted-foreground">Coming next</h2>
        <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>• Devotee directory &amp; families</li>
          <li>• Donations &amp; receipts</li>
          <li>• Events &amp; festival calendar</li>
          <li>• Website content &amp; themes</li>
          <li>• Staff invitations &amp; roles</li>
          <li>• Puja booking</li>
        </ul>
      </section>
    </div>
  );
}
