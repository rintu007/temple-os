import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { accountService } from '@/lib/services';

export const metadata: Metadata = { title: 'Accounts' };

interface AccountsPageProps {
  searchParams: Promise<{ scope?: string }>;
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const { scope } = await searchParams;
  const { ctx } = await requireTenantContext();
  const showAll = scope === 'all';

  const [result, stats] = await Promise.all([
    accountService().listAccounts(ctx, { scope: showAll ? 'all' : 'active' }),
    accountService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const accounts = result.value;
  const currency = stats.ok ? stats.value.currency : 'INR';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your bank accounts and cash boxes. Balances are derived from the opening balance plus
            donations received in and expenses paid out, so they always tie to the ledger.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/accounts/export.csv"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <Link
            href="/accounts/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Add account
          </Link>
        </div>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Total cash & bank balance</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.totalBalance, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Active accounts</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.activeCount}</div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Link
          href={showAll ? '/accounts' : '/accounts?scope=all'}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? 'Active only' : 'Show archived too'}
        </Link>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No accounts yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add a bank account or cash box, then tag donations and expenses to it as you record
            them.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {accounts.map((a) => (
            <li key={a.id}>
              <Link
                href={`/accounts/${a.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  !a.isActive && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {a.name}
                    <Badge variant="outline">{a.type === 'cash' ? 'Cash' : 'Bank'}</Badge>
                    {!a.isActive ? <Badge variant="outline">Archived</Badge> : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {a.type === 'cash'
                      ? 'Cash in hand'
                      : [a.bankName, a.accountNumberMasked].filter(Boolean).join(' · ') ||
                        'Bank account'}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={cn(
                      'font-semibold whitespace-nowrap tabular-nums',
                      Number(a.balance) < 0 && 'text-destructive',
                    )}
                  >
                    {formatMoney(a.balance, currency)}
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
