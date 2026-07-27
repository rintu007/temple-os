import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, cn, formatMoney } from '@templeos/ui';
import { toggleClearedAction } from '@/features/reconciliation/actions';
import { FinalizeForm } from '@/features/reconciliation/components/finalize-form';
import { requireTenantContext } from '@/lib/session';
import { reconciliationService } from '@/lib/services';

interface ReconcilePageProps {
  params: Promise<{ accountId: string }>;
}

export const metadata: Metadata = { title: 'Reconcile account' };

export default async function ReconcilePage({ params }: ReconcilePageProps) {
  const { accountId } = await params;
  const { ctx } = await requireTenantContext();

  const result = await reconciliationService().getReconciliation(ctx, accountId);
  if (!result.ok) notFound();
  const r = result.value;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/accounts/${accountId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {r.accountName}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Reconcile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tick off each entry that appears on your bank statement. When the cleared balance matches
          the statement, record the reconciliation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card shadow-card p-4">
          <div className="text-xs text-muted-foreground">Book balance</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">
            {formatMoney(r.bookBalance, r.currency)}
          </div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 shadow-card p-4">
          <div className="text-xs text-muted-foreground">Cleared balance</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">
            {formatMoney(r.clearedBalance, r.currency)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-card p-4">
          <div className="text-xs text-muted-foreground">Uncleared</div>
          <div className="mt-0.5 text-sm tabular-nums">
            <span className="text-success">+{formatMoney(r.unclearedReceipts, r.currency)}</span>
            {' · '}
            <span className="text-destructive">−{formatMoney(r.unclearedPayments, r.currency)}</span>
          </div>
        </div>
      </div>

      {r.lastReconciliation ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          Last reconciled to {formatMoney(r.lastReconciliation.statementBalance, r.currency)} as on{' '}
          {r.lastReconciliation.statementDate}
          {Number(r.lastReconciliation.difference) === 0
            ? ' (fully matched).'
            : ` (difference ${formatMoney(r.lastReconciliation.difference, r.currency)}).`}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold">
          Entries ({r.entries.length})
        </div>
        {r.entries.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No entries tagged to this account yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {r.entries.map((e) => {
              const isCredit = e.kind === 'receipt' || e.kind === 'transfer_in';
              return (
              <li
                key={`${e.kind}-${e.id}`}
                className={cn('flex items-center gap-3 px-5 py-2.5 text-sm', e.cleared && 'bg-muted/30')}
              >
                <form action={toggleClearedAction.bind(null, accountId, e.kind, e.id, !e.cleared)}>
                  <button
                    type="submit"
                    aria-label={e.cleared ? 'Mark uncleared' : 'Mark cleared'}
                    className={cn(
                      'flex size-5 items-center justify-center rounded border text-xs',
                      e.cleared
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input hover:border-primary',
                    )}
                  >
                    {e.cleared ? '✓' : ''}
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{e.ref}</span>
                  <span className="text-muted-foreground"> · {e.party}</span>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {isCredit ? 'In' : 'Out'}
                </Badge>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {e.at.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span
                  className={cn(
                    'w-24 shrink-0 text-right font-medium tabular-nums',
                    isCredit ? 'text-success' : 'text-destructive',
                  )}
                >
                  {isCredit ? '+' : '−'}
                  {formatMoney(e.amount, r.currency)}
                </span>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Record reconciliation</h2>
        <FinalizeForm
          accountId={accountId}
          currency={r.currency}
          clearedBalance={r.clearedBalance}
        />
      </section>
    </div>
  );
}
