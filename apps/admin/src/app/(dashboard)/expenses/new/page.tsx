import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpenseForm } from '@/features/expenses/components/expense-form';
import { requireTenantContext } from '@/lib/session';

export const metadata: Metadata = { title: 'Record expense' };

export default async function NewExpensePage() {
  const { membership } = await requireTenantContext();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/expenses" className="text-sm text-muted-foreground hover:text-foreground">
          ← Expenses
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Record an expense</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A voucher number is assigned automatically and the entry joins the books.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card p-6">
        <ExpenseForm currency={membership.currency} />
      </div>
    </div>
  );
}
