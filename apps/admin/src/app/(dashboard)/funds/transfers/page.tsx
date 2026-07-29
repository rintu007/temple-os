import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, formatMoney } from '@templeos/ui';
import { FundTransferForm } from '@/features/fund-transfers/components/fund-transfer-form';
import { requireTenantContext } from '@/lib/session';
import { fundService, fundTransferService } from '@/lib/services';

export const metadata: Metadata = { title: 'Fund reallocations' };

export default async function FundTransfersPage() {
  const { ctx, membership } = await requireTenantContext('accounting');

  const [result, stats, funds] = await Promise.all([
    fundTransferService().listTransfers(ctx),
    fundTransferService().getStats(ctx),
    fundService().listActiveOptions(ctx),
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
          <Link href="/funds" className="text-sm text-muted-foreground hover:text-foreground">
            ← Funds
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Fund reallocations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Move money between funds — from the general corpus into the building fund, say. A
            reallocation is neither income nor expense, so it stays out of the ledgers, but it moves
            each fund&apos;s balance and shows on the balance sheet.
          </p>
        </div>
        <a
          href="/funds/transfers/export.csv"
          className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
        >
          Export CSV
        </a>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Reallocate between funds</h2>
        <FundTransferForm funds={funds.ok ? funds.value : []} currency={membership.currency} />
      </section>

      {stats.ok && stats.value.count > 0 ? (
        <p className="text-sm text-muted-foreground">
          {stats.value.count} reallocation{stats.value.count === 1 ? '' : 's'} ·{' '}
          {formatMoney(stats.value.total, currency)} moved in total
        </p>
      ) : null}

      {transfers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No reallocations yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Recorded reallocations appear here and in each fund&apos;s ledger.
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
                    <Link href={`/funds/${t.fromFundId}`} className="hover:underline">
                      {t.fromFundName}
                    </Link>
                  </td>
                  <td className="px-5 py-2">
                    <Link href={`/funds/${t.toFundId}`} className="hover:underline">
                      {t.toFundName}
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
