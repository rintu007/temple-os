import type { Metadata } from 'next';
import Link from 'next/link';
import { createLoanAction } from '@/features/loans/actions';
import { LoanForm } from '@/features/loans/components/loan-form';
import { requireTenantContext } from '@/lib/session';
import { employeeService } from '@/lib/services';

export const metadata: Metadata = { title: 'Add loan' };

export default async function NewLoanPage() {
  const { ctx, membership } = await requireTenantContext();
  const employees = await employeeService().listActiveOptions(ctx);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/loans" className="text-sm text-muted-foreground hover:text-foreground">
          ← Loans &amp; advances
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add loan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record a loan the temple has given or taken. Log repayments from the loan page as they
          happen — the outstanding balance updates itself.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <LoanForm
          action={createLoanAction}
          currency={membership.currency}
          employees={employees.ok ? employees.value : []}
          submitLabel="Add loan"
        />
      </section>
    </div>
  );
}
