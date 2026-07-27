import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { FundLedgerEntry } from '@templeos/core';
import { Badge, Button, cn, formatMoney } from '@templeos/ui';
import { setFundActiveAction, updateFundAction } from '@/features/funds/actions';
import { FundForm } from '@/features/funds/components/fund-form';
import { requireTenantContext } from '@/lib/session';
import { fundService } from '@/lib/services';

interface FundDetailProps {
  params: Promise<{ fundId: string }>;
}

export const metadata: Metadata = { title: 'Fund' };

function EntryList({
  title,
  entries,
  currency,
  empty,
}: {
  title: string;
  entries: FundLedgerEntry[];
  currency: 'INR' | 'BDT';
  empty: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{e.ref}</span>
                <span className="text-muted-foreground"> · {e.party}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {e.at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="font-medium tabular-nums">{formatMoney(e.amount, currency)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function FundDetailPage({ params }: FundDetailProps) {
  const { fundId } = await params;
  const { ctx } = await requireTenantContext();

  const [result, stats] = await Promise.all([
    fundService().getFundDetail(ctx, fundId),
    fundService().getStats(ctx),
  ]);
  if (!result.ok) notFound();
  const { fund, income, expenditure, transfers } = result.value;
  const currency = stats.ok ? stats.value.currency : 'INR';
  const hasTransfers = Number(fund.transfersIn) > 0 || Number(fund.transfersOut) > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/funds" className="text-sm text-muted-foreground hover:text-foreground">
          ← Funds
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {fund.name}
              {!fund.isActive ? <Badge variant="outline">Inactive</Badge> : null}
            </h1>
            {fund.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{fund.description}</p>
            ) : null}
          </div>
          <div className="text-right">
            <div
              className={cn(
                'text-2xl font-semibold',
                Number(fund.balance) < 0 && 'text-destructive',
              )}
            >
              {formatMoney(fund.balance, currency)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatMoney(fund.income, currency)} in · {formatMoney(fund.expense, currency)} out
              {hasTransfers ? (
                <>
                  {' · '}
                  {formatMoney(fund.transfersIn, currency)} ⇄ in ·{' '}
                  {formatMoney(fund.transfersOut, currency)} ⇄ out
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <section className="grid gap-6 rounded-xl border border-border bg-card p-6 shadow-card md:grid-cols-2">
        <EntryList
          title="Income"
          entries={income}
          currency={currency}
          empty="No donations earmarked to this fund yet."
        />
        <EntryList
          title="Expenditure"
          entries={expenditure}
          currency={currency}
          empty="Nothing drawn from this fund yet."
        />
      </section>

      {transfers.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <EntryList
            title="Reallocations"
            entries={transfers}
            currency={currency}
            empty="No reallocations."
          />
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Fund details</h2>
        <FundForm
          action={updateFundAction.bind(null, fundId)}
          fund={fund}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-medium text-muted-foreground">
          {fund.isActive ? 'Deactivate fund' : 'Reactivate fund'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {fund.isActive
            ? 'Hide this fund from the earmarking dropdowns. Its history and balance are kept.'
            : 'Return this fund to the earmarking dropdowns.'}
        </p>
        <form action={setFundActiveAction.bind(null, fundId, !fund.isActive)} className="mt-4">
          <Button variant={fund.isActive ? 'destructive' : 'outline'} size="sm" type="submit">
            {fund.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </form>
      </section>
    </div>
  );
}
