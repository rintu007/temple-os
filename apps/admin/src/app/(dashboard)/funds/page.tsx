import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { fundService } from '@/lib/services';

export const metadata: Metadata = { title: 'Funds' };

interface FundsPageProps {
  searchParams: Promise<{ scope?: string }>;
}

export default async function FundsPage({ searchParams }: FundsPageProps) {
  const { scope } = await searchParams;
  const { ctx } = await requireTenantContext();
  const showAll = scope === 'all';

  const [result, stats] = await Promise.all([
    fundService().listFunds(ctx, { scope: showAll ? 'all' : 'active' }),
    fundService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const funds = result.value;
  const currency = stats.ok ? stats.value.currency : 'INR';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Funds</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Earmarked money buckets — corpus, building, annadanam. Balances are derived from
            donations earmarked in and expenses drawn out, so they never drift from the ledger.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/funds/transfers"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Reallocate
          </Link>
          <a
            href="/funds/export.csv"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <Link
            href="/funds/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Add fund
          </Link>
        </div>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Total held across funds</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.totalBalance, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Active funds</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.activeCount}</div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Link
          href={showAll ? '/funds' : '/funds?scope=all'}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? 'Active only' : 'Show inactive too'}
        </Link>
      </div>

      {funds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No funds yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create a fund, then earmark donations and expenses to it when recording them.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {funds.map((f) => (
            <li key={f.id}>
              <Link
                href={`/funds/${f.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  !f.isActive && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {f.name}
                    {!f.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {f.description ??
                      `${formatMoney(f.income, currency)} in · ${formatMoney(f.expense, currency)} out`}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={cn(
                      'font-semibold whitespace-nowrap',
                      Number(f.balance) < 0 && 'text-destructive',
                    )}
                  >
                    {formatMoney(f.balance, currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">balance</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
