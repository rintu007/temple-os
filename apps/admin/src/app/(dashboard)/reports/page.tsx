import type { Metadata } from 'next';
import { Alert, Button, Input, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { expenseService, reportService } from '@/lib/services';

export const metadata: Metadata = { title: 'Reports' };

interface ReportsPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  online: 'Online',
  other: 'Other',
};

function firstOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const from = params.from ?? firstOfMonth();
  const to = params.to ?? todayIso();
  const { ctx } = await requireTenantContext();

  const [result, expenseResult] = await Promise.all([
    reportService().getDonationReport(ctx, { from, to }),
    expenseService().getRangeSummary(ctx, { from, to }),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const report = result.value;
  const expenseTotal = expenseResult.ok ? expenseResult.value.total : '0.00';
  const net = (Number(report.total) - Number(expenseTotal)).toFixed(2);
  const csvHref = `/reports/donations.csv?${new URLSearchParams({ from, to })}`;
  const expenseCsvHref = `/reports/expenses.csv?${new URLSearchParams({ from, to })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All income — donations, puja bookings and memberships — in one ledger.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={csvHref}
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Income CSV
          </a>
          <a
            href={expenseCsvHref}
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Expenses CSV
          </a>
        </div>
      </div>

      <form action="/reports" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="from" className="text-sm font-medium">
            From
          </label>
          <Input id="from" name="from" type="date" defaultValue={from} className="w-44" />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="text-sm font-medium">
            To
          </label>
          <Input id="to" name="to" type="date" defaultValue={to} className="w-44" />
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card shadow-card p-5">
          <div className="text-sm text-muted-foreground">Income</div>
          <div className="mt-1 text-2xl font-semibold text-success">
            {formatMoney(report.total, report.currency)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {report.count} receipt{report.count === 1 ? '' : 's'}
            {report.voidCount > 0 ? ` · ${report.voidCount} voided` : ''}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-card p-5">
          <div className="text-sm text-muted-foreground">Expenses</div>
          <div className="mt-1 text-2xl font-semibold text-destructive">
            {formatMoney(expenseTotal, report.currency)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {expenseResult.ok ? `${expenseResult.value.count} voucher${expenseResult.value.count === 1 ? '' : 's'}` : ''}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-card p-5 sm:col-span-2">
          <div className="text-sm text-muted-foreground">Net for this period</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoney(net, report.currency)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Income minus expenses</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border">
          <h2 className="border-b border-border px-5 py-3 text-sm font-medium">By category</h2>
          {report.byCategory.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No donations in this range.</p>
          ) : (
            <ul className="divide-y divide-border">
              {report.byCategory.map((c) => (
                <li key={c.label} className="flex items-baseline justify-between px-5 py-3 text-sm">
                  <span>
                    {c.label}
                    <span className="ml-2 text-xs text-muted-foreground">×{c.count}</span>
                  </span>
                  <span className="font-medium">{formatMoney(c.total, report.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border">
          <h2 className="border-b border-border px-5 py-3 text-sm font-medium">By payment method</h2>
          {report.byMethod.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No donations in this range.</p>
          ) : (
            <ul className="divide-y divide-border">
              {report.byMethod.map((m) => (
                <li key={m.label} className="flex items-baseline justify-between px-5 py-3 text-sm">
                  <span>
                    {METHOD_LABELS[m.label] ?? m.label}
                    <span className="ml-2 text-xs text-muted-foreground">×{m.count}</span>
                  </span>
                  <span className="font-medium">{formatMoney(m.total, report.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
