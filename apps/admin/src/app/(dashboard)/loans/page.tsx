import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { loanService } from '@/lib/services';

export const metadata: Metadata = { title: 'Loans & advances' };

interface LoansPageProps {
  searchParams: Promise<{ scope?: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  closed: 'Closed',
  written_off: 'Written off',
};

export default async function LoansPage({ searchParams }: LoansPageProps) {
  const { scope } = await searchParams;
  const { ctx } = await requireTenantContext();
  const showAll = scope === 'all';

  const [result, stats] = await Promise.all([
    loanService().listLoans(ctx, { scope: showAll ? 'all' : 'active' }),
    loanService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const loans = result.value;
  const currency = stats.ok ? stats.value.currency : 'INR';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Loans &amp; advances</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Money the temple has lent (staff advances, loans to trusts) or borrowed. Outstanding
            balances are derived from the repayment ledger, so they never drift. Loans are a
            balance-sheet register — they stay out of the income &amp; expenditure statement.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/loans/export.csv"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <Link
            href="/loans/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Add loan
          </Link>
        </div>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Receivable (owed to us)</div>
            <div className="mt-1 text-2xl font-semibold text-success">
              {formatMoney(stats.value.receivable, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Payable (we owe)</div>
            <div className="mt-1 text-2xl font-semibold text-destructive">
              {formatMoney(stats.value.payable, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Active loans</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.activeCount}</div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Link
          href={showAll ? '/loans' : '/loans?scope=all'}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? 'Active only' : 'Show closed too'}
        </Link>
      </div>

      {loans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No loans yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Record a staff advance, a loan to an affiliated trust, or a loan the temple has taken,
            then log repayments as they happen.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {loans.map((l) => (
            <li key={l.id}>
              <Link
                href={`/loans/${l.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  l.status !== 'active' && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {l.counterparty}
                    <Badge variant={l.direction === 'given' ? 'primary' : 'outline'}>
                      {l.direction === 'given' ? 'Given' : 'Taken'}
                    </Badge>
                    {l.status !== 'active' ? (
                      <Badge variant="outline">{STATUS_LABEL[l.status]}</Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {l.title ? `${l.title} · ` : ''}
                    {formatMoney(l.principal, currency)} principal ·{' '}
                    {formatMoney(l.repaid, currency)} repaid
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={cn(
                      'font-semibold whitespace-nowrap tabular-nums',
                      l.direction === 'given' ? 'text-success' : 'text-destructive',
                    )}
                  >
                    {formatMoney(l.outstanding, currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">outstanding</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
