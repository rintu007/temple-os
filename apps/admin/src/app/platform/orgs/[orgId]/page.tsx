import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Button, PageHeader } from '@templeos/ui';
import { OverrideForm } from '@/features/platform/components/override-form';
import { setOrgStatusAction } from '@/features/platform/actions';
import { requirePlatformAdmin } from '@/lib/session';
import { planService, platformService } from '@/lib/services';

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
  const [result, plans] = await Promise.all([
    platformService().getOrgDetail(user.id, orgId),
    planService().listPlans(),
  ]);
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const org = result.value;
  const suspended = org.orgStatus === 'suspended';
  const planName = org.plan ? (plans.find((p) => p.key === org.plan)?.name ?? org.plan) : null;

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
              <dd>{planName ?? 'No subscription row (legacy — unrestricted)'}</dd>
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
          <OverrideForm organizationId={org.id} plans={plans} />
        </div>
      </div>
    </div>
  );
}
