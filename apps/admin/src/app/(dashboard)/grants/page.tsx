import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { grantService } from '@/lib/services';

export const metadata: Metadata = { title: 'Grants' };

interface GrantsPageProps {
  searchParams: Promise<{ scope?: string }>;
}

export default async function GrantsPage({ searchParams }: GrantsPageProps) {
  const { scope } = await searchParams;
  const { ctx } = await requireTenantContext();
  const showAll = scope === 'all';

  const [result, stats] = await Promise.all([
    grantService().listGrants(ctx, { scope: showAll ? 'all' : 'active' }),
    grantService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const grants = result.value;
  const currency = stats.ok ? stats.value.currency : 'INR';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Grants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Government, endowment-board and CSR grants. Received and utilized amounts are derived
            from the ledger, so the unspent balance for your utilization certificate always ties to
            the books.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/grants/export.csv"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <Link
            href="/grants/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Add grant
          </Link>
        </div>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Unspent grant balance</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.totalUnspent, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Active grants</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.activeCount}</div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Link
          href={showAll ? '/grants' : '/grants?scope=all'}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? 'Active only' : 'Show closed too'}
        </Link>
      </div>

      {grants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No grants yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Register a grant, then tag its releases (donations) and utilizations (expenses) as you
            record them.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {grants.map((g) => (
            <li key={g.id}>
              <Link
                href={`/grants/${g.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  g.status === 'closed' && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {g.title}
                    {g.status === 'closed' ? <Badge variant="outline">Closed</Badge> : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {g.funder}
                    {' · '}
                    {formatMoney(g.received, currency)} received ·{' '}
                    {formatMoney(g.utilized, currency)} used
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold whitespace-nowrap tabular-nums">
                    {formatMoney(g.unspent, currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">unspent</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
