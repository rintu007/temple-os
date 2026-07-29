import type { Metadata } from 'next';
import Link from 'next/link';
import { createEmployeeAction } from '@/features/payroll/actions';
import { EmployeeForm } from '@/features/payroll/components/employee-form';
import { requireTenantContext } from '@/lib/session';

export const metadata: Metadata = { title: 'Add staff' };

export default async function NewEmployeePage() {
  const { membership } = await requireTenantContext('accounting');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/payroll" className="text-sm text-muted-foreground hover:text-foreground">
          ← Payroll
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add staff</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a member of staff to the register. Record their salary payments from their profile.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <EmployeeForm
          action={createEmployeeAction}
          currency={membership.currency}
          submitLabel="Add staff"
        />
      </section>
    </div>
  );
}
