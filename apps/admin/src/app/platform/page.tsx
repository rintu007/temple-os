import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, PageHeader, StatCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@templeos/ui';
import { PLAN_CATALOG } from '@templeos/validators';
import { requirePlatformAdmin } from '@/lib/session';
import { platformService } from '@/lib/services';

export const metadata: Metadata = { title: 'Platform' };

function statusBadge(
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | null,
  isTrialExpired: boolean,
) {
  if (status === null) return <Badge variant="outline">Legacy — unrestricted</Badge>;
  if (isTrialExpired) return <Badge variant="destructive">Trial expired</Badge>;
  if (status === 'active') return <Badge variant="success">Active</Badge>;
  if (status === 'trialing') return <Badge variant="default">Trialing</Badge>;
  return <Badge variant="destructive">{status === 'past_due' ? 'Past due' : 'Canceled'}</Badge>;
}

export default async function PlatformPage() {
  const { user } = await requirePlatformAdmin();
  const result = await platformService().getOverview(user.id);

  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const { organizations, totalOrganizations, totalMrrUsd, activeSubscriptions, trialing } =
    result.value;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform"
        description="Every temple on TempleOS — plan, subscription status, and MRR. Click an org to manage its subscription."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Organizations" value={totalOrganizations} />
        <StatCard label="Active subscriptions" value={activeSubscriptions} />
        <StatCard label="On trial" value={trialing} />
        <StatCard label="MRR" value={`$${totalMrrUsd.toLocaleString('en-US')}`} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Trial / renewal</TableHead>
            <TableHead>Signed up</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((org) => (
            <TableRow key={org.id}>
              <TableCell>
                <Link href={`/platform/orgs/${org.id}`} className="font-medium hover:underline">
                  {org.name}
                </Link>
                {org.orgStatus === 'suspended' ? (
                  <Badge variant="destructive" className="ml-2">
                    Suspended
                  </Badge>
                ) : null}
                <div className="text-xs text-muted-foreground">{org.slug}</div>
              </TableCell>
              <TableCell>{org.country}</TableCell>
              <TableCell>{org.plan ? PLAN_CATALOG[org.plan].name : '—'}</TableCell>
              <TableCell>{statusBadge(org.subscriptionStatus, org.isTrialExpired)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {org.subscriptionStatus === 'trialing' && org.trialEndsAt
                  ? org.trialEndsAt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                  : org.currentPeriodEnd
                    ? org.currentPeriodEnd.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {org.createdAt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
