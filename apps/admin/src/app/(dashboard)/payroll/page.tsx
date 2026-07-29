import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { employeeService } from '@/lib/services';

export const metadata: Metadata = { title: 'Payroll' };

interface PayrollPageProps {
  searchParams: Promise<{ scope?: string }>;
}

const TYPE_LABELS: Record<string, string> = {
  salaried: 'Salaried',
  priest: 'Priest',
  wage: 'Daily wage',
  honorary: 'Honorary',
};

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  const { scope } = await searchParams;
  const { ctx } = await requireTenantContext('accounting');
  const showAll = scope === 'all';

  const [result, stats] = await Promise.all([
    employeeService().listEmployees(ctx, { scope: showAll ? 'all' : 'active' }),
    employeeService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const employees = result.value;
  const currency = stats.ok ? stats.value.currency : 'INR';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your staff register — priests, cooks, cleaners, security. Salary paid is derived from
            the expense ledger, so it always ties to the books.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/payroll/export.csv"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <Link
            href="/payroll/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Add staff
          </Link>
        </div>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Monthly payroll</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.monthlyPayroll, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Paid this FY</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.paidThisFy, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Active staff</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.activeCount}</div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Link
          href={showAll ? '/payroll' : '/payroll?scope=all'}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? 'Active only' : 'Show inactive too'}
        </Link>
      </div>

      {employees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No staff yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add your priests and staff, then record each salary payment against them.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {employees.map((e) => (
            <li key={e.id}>
              <Link
                href={`/payroll/${e.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  !e.isActive && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {e.name}
                    <Badge variant="outline">{TYPE_LABELS[e.employmentType] ?? e.employmentType}</Badge>
                    {!e.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {[e.designation, e.monthlySalary ? `${formatMoney(e.monthlySalary, currency)}/mo` : null]
                      .filter(Boolean)
                      .join(' · ') || 'Staff member'}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold whitespace-nowrap tabular-nums">
                    {formatMoney(e.paidThisFy, currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">paid this FY</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
