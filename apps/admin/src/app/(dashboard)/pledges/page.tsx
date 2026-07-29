import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, Button, Input, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { pledgeService } from '@/lib/services';

export const metadata: Metadata = { title: 'Pledges' };

interface PledgesPageProps {
  searchParams: Promise<{ q?: string; scope?: string }>;
}

export default async function PledgesPage({ searchParams }: PledgesPageProps) {
  const { q, scope } = await searchParams;
  const { ctx } = await requireTenantContext('finance-basic');
  const showAll = scope === 'all';

  const [result, stats] = await Promise.all([
    pledgeService().listPledges(ctx, { search: q ?? '', scope: showAll ? 'all' : 'open' }),
    pledgeService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const pledges = result.value;
  const currency = stats.ok ? stats.value.currency : 'INR';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pledges</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Promised donations. Recording a receipt against a pledge posts a real donation, so
            fulfilment always matches the receipt book.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/pledges/export.csv"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <Link
            href="/pledges/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Record pledge
          </Link>
        </div>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Outstanding</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.totalOutstanding, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Overdue</div>
            <div
              className={cn(
                'mt-1 text-2xl font-semibold',
                Number(stats.value.overdueOutstanding) > 0 && 'text-destructive',
              )}
            >
              {formatMoney(stats.value.overdueOutstanding, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Total pledged (open)</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.totalPledged, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Open pledges</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.openCount}</div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action="/pledges" className="flex max-w-md flex-1 gap-2">
          {showAll ? <input type="hidden" name="scope" value="all" /> : null}
          <Input name="q" placeholder="Search by donor or note…" defaultValue={q ?? ''} />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <Link
          href={showAll ? '/pledges' : '/pledges?scope=all'}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? 'Open only' : 'Show cancelled/fulfilled too'}
        </Link>
      </div>

      {pledges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">{q ? 'No matches' : 'No pledges yet'}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {q ? `Nothing found for “${q}”.` : 'Record a pledge to start tracking commitments.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {pledges.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pledges/${p.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  p.status === 'cancelled' && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {p.donorName}
                    {p.status === 'cancelled' ? (
                      <Badge variant="outline">Cancelled</Badge>
                    ) : p.isOverdue ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : p.progress === 'fulfilled' ? (
                      <Badge variant="success">Fulfilled</Badge>
                    ) : p.progress === 'partial' ? (
                      <Badge variant="warning">Partial</Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {p.campaignTitle ? `${p.campaignTitle} · ` : ''}
                    pledged{' '}
                    {new Date(`${p.pledgedOn}T12:00:00`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {p.dueDate
                      ? ` · due ${new Date(`${p.dueDate}T12:00:00`).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}`
                      : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {p.status === 'open' && Number(p.outstanding) > 0 ? (
                    <>
                      <div className="font-semibold whitespace-nowrap">
                        {formatMoney(p.outstanding, p.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        of {formatMoney(p.amount, p.currency)}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {formatMoney(p.amount, p.currency)}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
