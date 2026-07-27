import type { Metadata } from 'next';
import type { StatementLine } from '@templeos/core';
import { Alert, cn, formatMoney } from '@templeos/ui';
import { PrintButton } from '@/features/annual-report/components/print-button';
import { requireTenantContext } from '@/lib/session';
import { statementService } from '@/lib/services';

export const metadata: Metadata = { title: 'Annual report' };

interface AnnualReportProps {
  searchParams: Promise<{ fy?: string }>;
}

/** Current financial-year start year (Indian FY: April–March). */
function currentFyStartYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function fyRange(startYear: number) {
  return {
    from: `${startYear}-04-01`,
    to: `${startYear + 1}-03-31`,
    label: `${startYear}–${startYear + 1}`,
  };
}

function StatementColumn({
  title,
  lines,
  total,
  totalLabel,
  currency,
  empty,
}: {
  title: string;
  lines: StatementLine[];
  total: string;
  totalLabel: string;
  currency: 'INR' | 'BDT';
  empty: string;
}) {
  return (
    <div>
      <h3 className="border-b border-border pb-1 text-sm font-semibold">{title}</h3>
      {lines.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {lines.map((l) => (
              <tr key={l.label}>
                <td className="py-1 pr-2">{l.label}</td>
                <td className="py-1 text-right tabular-nums">{formatMoney(l.total, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-1 flex items-center justify-between border-t-2 border-border pt-1 text-sm font-semibold">
        <span>{totalLabel}</span>
        <span className="tabular-nums">{formatMoney(total, currency)}</span>
      </div>
    </div>
  );
}

export default async function AnnualReportPage({ searchParams }: AnnualReportProps) {
  const { fy } = await searchParams;
  const { ctx, membership } = await requireTenantContext();

  const currentStart = currentFyStartYear();
  const parsed = fy ? Number.parseInt(fy, 10) : currentStart;
  const startYear = Number.isFinite(parsed) ? parsed : currentStart;
  const range = fyRange(startYear);

  const [ie, rp, bs] = await Promise.all([
    statementService().getStatement(ctx, { from: range.from, to: range.to }),
    statementService().getReceiptsAndPayments(ctx, { from: range.from, to: range.to }),
    statementService().getBalanceSheet(ctx),
  ]);
  if (!ie.ok || !rp.ok || !bs.ok) {
    const err = !ie.ok ? ie.error : !rp.ok ? rp.error : !bs.ok ? bs.error : null;
    return <Alert tone="error">{err?.message ?? 'Could not build the report'}</Alert>;
  }
  const currency = ie.value.currency;
  const surplus = Number(ie.value.net);
  const years = Array.from({ length: 5 }, (_, i) => currentStart - i);

  return (
    <div className="space-y-6">
      {/* Toolbar — hidden when printing */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Annual report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The statutory accounts for the year, ready to print or save as a PDF for your AGM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-input">
            {years.map((y) => (
              <a
                key={y}
                href={`/annual-report?fy=${y}`}
                className={cn(
                  'px-3 py-1.5 text-sm',
                  y === startYear
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-muted/60',
                )}
              >
                {fyRange(y).label}
              </a>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>

      {/* The printable document */}
      <div className="mx-auto max-w-4xl space-y-8 rounded-xl border border-border bg-card p-8 shadow-card print:border-0 print:shadow-none">
        <header className="text-center">
          <h2 className="text-xl font-semibold">{membership.organizationName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Annual Financial Statements · FY {range.label}
          </p>
        </header>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Income</div>
            <div className="mt-0.5 font-semibold tabular-nums">
              {formatMoney(ie.value.incomeTotal, currency)}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Expenditure</div>
            <div className="mt-0.5 font-semibold tabular-nums">
              {formatMoney(ie.value.expenditureTotal, currency)}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">
              {surplus < 0 ? 'Deficit' : 'Surplus'}
            </div>
            <div
              className={cn(
                'mt-0.5 font-semibold tabular-nums',
                surplus < 0 && 'text-destructive',
              )}
            >
              {formatMoney(ie.value.net, currency)}
            </div>
          </div>
        </div>

        <section className="space-y-3 break-inside-avoid">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Income &amp; Expenditure Account · FY {range.label}
          </h3>
          <div className="grid gap-8 md:grid-cols-2">
            <StatementColumn
              title="Expenditure"
              lines={ie.value.expenditure}
              total={ie.value.expenditureTotal}
              totalLabel="Total expenditure"
              currency={currency}
              empty="No expenditure recorded."
            />
            <StatementColumn
              title="Income"
              lines={ie.value.income}
              total={ie.value.incomeTotal}
              totalLabel="Total income"
              currency={currency}
              empty="No income recorded."
            />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-2 text-sm font-semibold">
            <span>{surplus < 0 ? 'Deficit carried to funds' : 'Surplus carried to funds'}</span>
            <span className="tabular-nums">{formatMoney(ie.value.net, currency)}</span>
          </div>
        </section>

        <section className="space-y-3 break-inside-avoid">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Receipts &amp; Payments Account · FY {range.label}
          </h3>
          <div className="grid gap-8 md:grid-cols-2">
            <StatementColumn
              title={`Payments (closing ${formatMoney(rp.value.closingBalance, currency)})`}
              lines={rp.value.payments}
              total={rp.value.paymentsTotal}
              totalLabel="Total payments"
              currency={currency}
              empty="No payments recorded."
            />
            <StatementColumn
              title={`Receipts (opening ${formatMoney(rp.value.openingBalance, currency)})`}
              lines={rp.value.receipts}
              total={rp.value.receiptsTotal}
              totalLabel="Total receipts"
              currency={currency}
              empty="No receipts recorded."
            />
          </div>
        </section>

        <section className="space-y-3 break-inside-avoid">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Balance Sheet · as on {bs.value.asOf}
          </h3>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <StatementColumn
                title="Funds"
                lines={bs.value.funds}
                total={bs.value.fundsTotal}
                totalLabel="Total funds"
                currency={currency}
                empty="No fund balances."
              />
              <StatementColumn
                title="Liabilities"
                lines={bs.value.liabilities}
                total={bs.value.liabilitiesTotal}
                totalLabel="Total liabilities"
                currency={currency}
                empty="No liabilities."
              />
            </div>
            <StatementColumn
              title="Assets"
              lines={bs.value.assets}
              total={bs.value.assetsTotal}
              totalLabel="Total assets"
              currency={currency}
              empty="No assets."
            />
          </div>
          {bs.value.memorandum.length > 0 ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-sm">
              <div className="font-medium">Memorandum (not included in the totals above)</div>
              <dl className="mt-1.5 space-y-1">
                {bs.value.memorandum.map((l) => (
                  <div key={l.label} className="flex justify-between">
                    <dt className="text-muted-foreground">{l.label}</dt>
                    <dd className="tabular-nums">{formatMoney(l.total, currency)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </section>

        <section className="grid grid-cols-3 gap-8 pt-8 text-center text-sm break-inside-avoid">
          {['Treasurer', 'Secretary', 'President'].map((role) => (
            <div key={role}>
              <div className="mt-8 border-t border-border pt-1 text-muted-foreground">{role}</div>
            </div>
          ))}
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Derived from the ledger · the general fund is the balancing figure · excludes voided
          entries
        </p>
      </div>
    </div>
  );
}
