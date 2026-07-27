import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { investmentService } from '@/lib/services';

export const metadata: Metadata = { title: 'Investments' };

interface InvestmentsPageProps {
  searchParams: Promise<{ scope?: string }>;
}

const TYPE_LABEL: Record<string, string> = {
  fixed_deposit: 'Fixed deposit',
  recurring_deposit: 'Recurring deposit',
  bond: 'Bond',
  mutual_fund: 'Mutual fund',
  other: 'Other',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  matured: 'Matured',
  closed: 'Closed',
};

export default async function InvestmentsPage({ searchParams }: InvestmentsPageProps) {
  const { scope } = await searchParams;
  const { ctx } = await requireTenantContext();
  const showAll = scope === 'all';

  const [result, stats] = await Promise.all([
    investmentService().listInvestments(ctx, { scope: showAll ? 'all' : 'active' }),
    investmentService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const investments = result.value;
  const currency = stats.ok ? stats.value.currency : 'INR';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fixed deposits, recurring deposits, bonds and funds the temple parks its corpus in.
            Interest earned is derived from the maturity value on each receipt. A balance-sheet
            asset register — like loans, it stays out of the income &amp; expenditure statement.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/investments/export.csv"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <Link
            href="/investments/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Add investment
          </Link>
        </div>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Invested (corpus parked)</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.totalInvested, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Value at maturity</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.totalMaturityValue, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Expected interest</div>
            <div className="mt-1 text-2xl font-semibold text-success">
              {formatMoney(stats.value.expectedInterest, currency)}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Link
          href={showAll ? '/investments' : '/investments?scope=all'}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? 'Active only' : 'Show matured/closed too'}
        </Link>
      </div>

      {investments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No investments yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Record a fixed deposit or bond so the corpus, maturity dates and interest are tracked in
            one place.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {investments.map((i) => (
            <li key={i.id}>
              <Link
                href={`/investments/${i.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  i.status !== 'active' && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {i.institution}
                    <Badge variant="outline">{TYPE_LABEL[i.type]}</Badge>
                    {i.status !== 'active' ? (
                      <Badge variant="outline">{STATUS_LABEL[i.status]}</Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {formatMoney(i.principal, currency)} principal
                    {i.maturityDate ? ` · matures ${i.maturityDate}` : ''}
                    {i.fundName ? ` · ${i.fundName}` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold whitespace-nowrap tabular-nums">
                    {i.maturityValue
                      ? formatMoney(i.maturityValue, currency)
                      : formatMoney(i.principal, currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {i.interestEarned
                      ? `+${formatMoney(i.interestEarned, currency)} interest`
                      : 'at maturity'}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
