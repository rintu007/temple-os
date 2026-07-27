import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, cn, formatMoney } from '@templeos/ui';
import { setLoanStatusAction, updateLoanAction } from '@/features/loans/actions';
import { LoanForm } from '@/features/loans/components/loan-form';
import { RepaymentForm } from '@/features/loans/components/repayment-form';
import { requireTenantContext } from '@/lib/session';
import { employeeService, loanService } from '@/lib/services';

interface LoanDetailProps {
  params: Promise<{ loanId: string }>;
}

export const metadata: Metadata = { title: 'Loan' };

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  closed: 'Closed',
  written_off: 'Written off',
};

export default async function LoanDetailPage({ params }: LoanDetailProps) {
  const { loanId } = await params;
  const { ctx, membership } = await requireTenantContext();

  const [result, employees] = await Promise.all([
    loanService().getLoanDetail(ctx, loanId),
    employeeService().listActiveOptions(ctx),
  ]);
  if (!result.ok) notFound();
  const { loan, currency, repayments } = result.value;
  const settled = loan.status !== 'active' || Number(loan.outstanding) <= 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/loans" className="text-sm text-muted-foreground hover:text-foreground">
          ← Loans &amp; advances
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {loan.counterparty}
              <Badge variant={loan.direction === 'given' ? 'primary' : 'outline'}>
                {loan.direction === 'given' ? 'Given' : 'Taken'}
              </Badge>
              {loan.status !== 'active' ? (
                <Badge variant="outline">{STATUS_LABEL[loan.status]}</Badge>
              ) : null}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loan.title ? `${loan.title} · ` : ''}
              {loan.employeeName ? `Staff advance · ${loan.employeeName} · ` : ''}
              disbursed {loan.disbursedOn}
              {loan.dueOn ? ` · due ${loan.dueOn}` : ''}
              {loan.interestRate ? ` · ${loan.interestRate}% p.a.` : ''}
            </p>
          </div>
          <div className="text-right">
            <div
              className={cn(
                'text-2xl font-semibold tabular-nums',
                loan.direction === 'given' ? 'text-success' : 'text-destructive',
              )}
            >
              {formatMoney(loan.outstanding, currency)}
            </div>
            <div className="text-xs text-muted-foreground">outstanding</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Principal', value: loan.principal },
          { label: 'Repaid', value: loan.repaid },
          { label: 'Outstanding', value: loan.outstanding },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card shadow-card p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="mt-0.5 font-semibold tabular-nums">{formatMoney(s.value, currency)}</div>
          </div>
        ))}
      </div>

      {!settled ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Record a repayment</h2>
          <RepaymentForm loanId={loanId} currency={currency} outstanding={loan.outstanding} />
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold">
          Repayments ({repayments.length})
        </div>
        {repayments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No repayments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {repayments.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium tabular-nums">{formatMoney(r.amount, currency)}</span>
                  {r.note ? <span className="text-muted-foreground"> · {r.note}</span> : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{r.paidOn}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Loan details</h2>
        <LoanForm
          action={updateLoanAction.bind(null, loanId)}
          loan={loan}
          currency={membership.currency}
          employees={employees.ok ? employees.value : []}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-medium text-muted-foreground">Status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Close a loan once it is fully settled, or write it off if it will not be recovered. Either
          removes it from the active list; history is kept.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {loan.status === 'active' ? (
            <>
              <form action={setLoanStatusAction.bind(null, loanId, 'closed')}>
                <Button variant="outline" size="sm" type="submit">
                  Close (settled)
                </Button>
              </form>
              <form action={setLoanStatusAction.bind(null, loanId, 'written_off')}>
                <Button variant="destructive" size="sm" type="submit">
                  Write off
                </Button>
              </form>
            </>
          ) : (
            <form action={setLoanStatusAction.bind(null, loanId, 'active')}>
              <Button variant="outline" size="sm" type="submit">
                Reopen
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
