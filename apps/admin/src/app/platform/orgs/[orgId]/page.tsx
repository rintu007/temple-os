import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PLAN_CATALOG } from '@templeos/validators';
import { Alert, Button, PageHeader } from '@templeos/ui';
import { OverrideForm } from '@/features/platform/components/override-form';
import { setOrgStatusAction } from '@/features/platform/actions';
import { requirePlatformAdmin } from '@/lib/session';
import { platformService } from '@/lib/services';

interface OrgDetailPageProps {
  params: Promise<{ orgId: string }>;
}

export const metadata: Metadata = { title: 'Organization · Platform' };

function formatDate(d: Date | null): string {
  return d ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export default async function OrgDetailPage({ params }: OrgDetailPageProps) {
  const { orgId } = await params;
  const { user } = await requirePlatformAdmin();
  const result = await platformService().getOrgDetail(user.id, orgId);
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const org = result.value;
  const suspended = org.orgStatus === 'suspended';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/platform" className="text-sm text-muted-foreground hover:text-foreground">
          ← Platform
        </Link>
      </div>

      <PageHeader
        title={org.name}
        description={`${org.slug} · ${org.country} · signed up ${formatDate(org.createdAt)}`}
        actions={
          <form action={setOrgStatusAction.bind(null, org.id, suspended ? 'active' : 'suspended')}>
            <Button type="submit" variant={suspended ? 'primary' : 'destructive'}>
              {suspended ? 'Reactivate organization' : 'Suspend organization'}
            </Button>
          </form>
        }
      />

      {suspended ? (
        <Alert tone="info">
          This organization is suspended — its staff cannot access the admin dashboard. Its public
          site and donation intake are unaffected.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-sm font-medium text-muted-foreground">Current subscription</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Plan</dt>
              <dd>{org.plan ? PLAN_CATALOG[org.plan].name : 'No subscription row (legacy — unrestricted)'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="capitalize">{org.subscriptionStatus ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Trial ends</dt>
              <dd>{formatDate(org.trialEndsAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Current period end</dt>
              <dd>{formatDate(org.currentPeriodEnd)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">MRR</dt>
              <dd>${org.mrrUsd}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Override subscription</h2>
          <OverrideForm organizationId={org.id} />
        </div>
      </div>
    </div>
  );
}
