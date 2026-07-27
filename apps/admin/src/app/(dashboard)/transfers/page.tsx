import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, formatMoney } from '@templeos/ui';
import { TransferForm } from '@/features/transfers/components/transfer-form';
import { requireTenantContext } from '@/lib/session';
import { accountService, transferService } from '@/lib/services';

export const metadata: Metadata = { title: 'Transfers' };

export default async function TransfersPage() {
  const { ctx, membership } = await requireTenantContext();

  const [result, stats, accounts] = await Promise.all([
    transferService().listTransfers(ctx),
    transferService().getStats(ctx),
    accountService().listActiveOptions(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const transfers = result.value;
  const currency = stats.ok ? stats.value.currency : membership.currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transfers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Move money between the temple&apos;s own accounts — bank to cash box, one bank to
            another. A transfer is neither income nor expense, so it stays out of the ledgers, but
            it updates both account balances and appears on each account&apos;s reconciliation.
          </p>
        </div>
        <a
          href="/transfers/export.csv"
          className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
        >
          Export CSV
        </a>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Record a transfer</h2>
        <TransferForm accounts={accounts.ok ? accounts.value : []} currency={membership.currency} />
      </section>

      {stats.ok && stats.value.count > 0 ? (
        <p className="text-sm text-muted-foreground">
          {stats.value.count} transfer{stats.value.count === 1 ? '' : 's'} ·{' '}
          {formatMoney(stats.value.total, currency)} moved in total
        </p>
      ) : null}

      {transfers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No transfers yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Recorded transfers appear here and in each account&apos;s passbook.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-5 py-2 font-medium">From</th>
                <th className="px-5 py-2 font-medium">To</th>
                <th className="px-5 py-2 font-medium">Reference</th>
                <th className="px-5 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-border/60">
                  <td className="px-5 py-2 whitespace-nowrap text-muted-foreground">
                    {t.transferredOn}
                  </td>
                  <td className="px-5 py-2">
                    <Link href={`/accounts/${t.fromAccountId}`} className="hover:underline">
                      {t.fromAccountName}
                    </Link>
                  </td>
                  <td className="px-5 py-2">
                    <Link href={`/accounts/${t.toAccountId}`} className="hover:underline">
                      {t.toAccountName}
                    </Link>
                  </td>
                  <td className="px-5 py-2 text-muted-foreground">{t.reference ?? '—'}</td>
                  <td className="px-5 py-2 text-right font-medium tabular-nums">
                    {formatMoney(t.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
