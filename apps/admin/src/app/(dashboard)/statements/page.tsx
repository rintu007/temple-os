import type { Metadata } from 'next';
import { financialYearOf, financialYearRange, type StatementLine } from '@templeos/core';
import { Alert, cn, formatMoney } from '@templeos/ui';
import { PrintButton } from '@/components/print-button';
import { requireTenantContext } from '@/lib/session';
import { statementService } from '@/lib/services';

export const metadata: Metadata = { title: 'I&E statement' };

interface StatementPageProps {
  searchParams: Promise<{ fy?: string; from?: string; to?: string }>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function StatementSection({
  title,
  lines,
  total,
  currency,
}: {
  title: string;
  lines: StatementLine[];
  total: string;
  currency: 'INR' | 'BDT';
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <table className="w-full text-sm">
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td className="py-1.5 text-muted-foreground">None recorded</td>
              <td />
            </tr>
          ) : (
            lines.map((l) => (
              <tr key={l.label} className="border-b border-border/60">
                <td className="py-1.5">{l.label}</td>
                <td className="py-1.5 text-right tabular-nums">{formatMoney(l.total, currency)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold">
            <td className="py-2">Total {title.toLowerCase()}</td>
            <td className="py-2 text-right tabular-nums">{formatMoney(total, currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default async function StatementPage({ searchParams }: StatementPageProps) {
  const params = await searchParams;
  const { ctx, membership } = await requireTenantContext();

  const currentFy = financialYearOf(new Date());
  const custom = DATE.test(params.from ?? '') && DATE.test(params.to ?? '');
  const fyStart = Number.isFinite(Number(params.fy)) && params.fy ? Number(params.fy) : currentFy;
  const range = custom
    ? { from: params.from!, to: params.to! }
    : { from: financialYearRange(fyStart).from, to: financialYearRange(fyStart).to };

  const result = await statementService().getStatement(ctx, range);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const s = result.value;
  const isDeficit = s.net.startsWith('-');
  const netDisplay = formatMoney(s.net.replace('-', ''), s.currency);

  const fyOptions = Array.from({ length: 5 }, (_, i) => currentFy - i);
  const csvHref = `/statements/statement.csv?${new URLSearchParams(range)}`;

  const periodLabel = custom
    ? `${range.from} to ${range.to}`
    : financialYearRange(fyStart).label + ' (Apr–Mar)';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Income &amp; Expenditure</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The formal statement of income and expenditure for a financial year — for your AGM,
            trustees and auditors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={csvHref}
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Period picker */}
      <form action="/statements" className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="space-y-1.5">
          <label htmlFor="fy" className="text-sm font-medium">
            Financial year
          </label>
          <select
            id="fy"
            name="fy"
            defaultValue={custom ? '' : String(fyStart)}
            className="h-9.5 rounded-lg border border-input bg-card px-3 text-sm"
          >
            {fyOptions.map((y) => (
              <option key={y} value={y}>
                {y}–{y + 1}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card hover:bg-primary/90"
        >
          View
        </button>
      </form>

      {/* The statement document */}
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 shadow-card print:border-0 print:shadow-none">
        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold">{membership.organizationName}</h2>
          <p className="text-sm text-muted-foreground">Income &amp; Expenditure Statement</p>
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
        </div>

        <div className="space-y-8">
          <StatementSection title="Income" lines={s.income} total={s.incomeTotal} currency={s.currency} />
          <StatementSection
            title="Expenditure"
            lines={s.expenditure}
            total={s.expenditureTotal}
            currency={s.currency}
          />

          <div
            className={cn(
              'flex items-center justify-between rounded-lg border px-4 py-3 text-base font-semibold',
              isDeficit
                ? 'border-destructive/30 bg-destructive/5 text-destructive'
                : 'border-success/30 bg-success/5 text-success',
            )}
          >
            <span>{isDeficit ? 'Deficit for the period' : 'Surplus for the period'}</span>
            <span className="tabular-nums">{netDisplay}</span>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Generated by TempleOS · figures exclude voided entries
        </p>
      </div>
    </div>
  );
}
