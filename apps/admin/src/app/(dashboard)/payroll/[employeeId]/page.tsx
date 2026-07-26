import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, formatMoney } from '@templeos/ui';
import { setEmployeeActiveAction, updateEmployeeAction } from '@/features/payroll/actions';
import { EmployeeForm } from '@/features/payroll/components/employee-form';
import { requireTenantContext } from '@/lib/session';
import { employeeService } from '@/lib/services';

interface EmployeeDetailProps {
  params: Promise<{ employeeId: string }>;
}

export const metadata: Metadata = { title: 'Staff member' };

const TYPE_LABELS: Record<string, string> = {
  salaried: 'Salaried',
  priest: 'Priest',
  wage: 'Daily wage',
  honorary: 'Honorary',
};

export default async function EmployeeDetailPage({ params }: EmployeeDetailProps) {
  const { employeeId } = await params;
  const { ctx, membership } = await requireTenantContext();

  const result = await employeeService().getEmployeeDetail(ctx, employeeId);
  if (!result.ok) notFound();
  const { employee, payments } = result.value;
  const currency = membership.currency;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/payroll" className="text-sm text-muted-foreground hover:text-foreground">
          ← Payroll
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {employee.name}
              <Badge variant="outline">
                {TYPE_LABELS[employee.employmentType] ?? employee.employmentType}
              </Badge>
              {!employee.isActive ? <Badge variant="outline">Inactive</Badge> : null}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                employee.designation,
                employee.monthlySalary ? `${formatMoney(employee.monthlySalary, currency)}/mo` : null,
                employee.phone,
              ]
                .filter(Boolean)
                .join(' · ') || 'Staff member'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">
              {formatMoney(employee.paidThisFy, currency)}
            </div>
            <div className="text-xs text-muted-foreground">paid this FY</div>
          </div>
        </div>
      </div>

      {employee.isActive ? (
        <Link
          href={`/expenses/new?employee=${employee.id}`}
          className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
        >
          Record salary payment
        </Link>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold">Payment history</div>
        {payments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No salary payments recorded yet. Use “Record salary payment” to log one — it joins the
            expense ledger.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <Link href={`/expenses/${p.id}`} className="font-medium hover:underline">
                    {p.voucherNumber}
                  </Link>
                  {p.categoryName ? (
                    <span className="text-muted-foreground"> · {p.categoryName}</span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {p.at.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="font-medium tabular-nums">{formatMoney(p.amount, currency)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Staff details</h2>
        <EmployeeForm
          action={updateEmployeeAction.bind(null, employeeId)}
          employee={employee}
          currency={currency}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-medium text-muted-foreground">
          {employee.isActive ? 'Deactivate staff member' : 'Reactivate staff member'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {employee.isActive
            ? 'Hide them from the register and salary dropdowns. Their history is kept.'
            : 'Return them to the active register.'}
        </p>
        <form
          action={setEmployeeActiveAction.bind(null, employeeId, !employee.isActive)}
          className="mt-4"
        >
          <Button variant={employee.isActive ? 'destructive' : 'outline'} size="sm" type="submit">
            {employee.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </form>
      </section>
    </div>
  );
}
