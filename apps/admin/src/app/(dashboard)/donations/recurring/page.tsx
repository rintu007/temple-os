import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { recurringDonationService } from '@/lib/services';

export const metadata: Metadata = { title: 'Recurring donations' };

interface RecurringDonationsPageProps {
  searchParams: Promise<{ scope?: string }>;
}

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  ended: 'Ended',
};

export default async function RecurringDonationsPage({
  searchParams,
}: RecurringDonationsPageProps) {
  const { scope } = await searchParams;
  const { ctx } = await requireTenantContext();
  const showAll = scope === 'all';

  const [result, stats] = await Promise.all([
    recurringDonationService().listRecurring(ctx, { scope: showAll ? 'all' : 'active' }),
    recurringDonationService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const items = result.value;
  const currency = stats.ok ? stats.value.currency : 'INR';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/donations" className="text-sm text-muted-foreground hover:text-foreground">
            ← Donations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Recurring donations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Standing gifts a devotee commits to on a cadence. Record each receipt from here to keep
            the ledger tied to the schedule; due dates surface in Insights.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/donations/recurring/export.csv"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <Link
            href="/donations/recurring/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Add standing gift
          </Link>
        </div>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Monthly-equivalent commitment</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.monthlyEquivalent, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Active standing gifts</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.activeCount}</div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Link
          href={showAll ? '/donations/recurring' : '/donations/recurring?scope=all'}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? 'Active only' : 'Show paused/ended too'}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No standing gifts yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add a devotee&apos;s monthly or annual commitment so the next gift is never missed.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {items.map((r) => {
            const overdue = r.nextDue != null && r.nextDue < today;
            return (
              <li key={r.id}>
                <Link
                  href={`/donations/recurring/${r.id}`}
                  className={cn(
                    'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                    r.status !== 'active' && 'opacity-60',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      {r.donorName}
                      <Badge variant="outline">{FREQUENCY_LABEL[r.frequency]}</Badge>
                      {r.status !== 'active' ? (
                        <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {r.fundName ? `${r.fundName} · ` : ''}
                      {r.nextDue ? (
                        <span className={cn(overdue && 'font-medium text-destructive')}>
                          {overdue ? 'overdue · ' : 'next '}
                          {r.nextDue}
                        </span>
                      ) : (
                        'no upcoming date'
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold whitespace-nowrap tabular-nums">
                      {formatMoney(r.amount, currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      per {r.frequency.replace('ly', '')}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
