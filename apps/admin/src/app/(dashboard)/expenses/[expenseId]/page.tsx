import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, formatMoney } from '@templeos/ui';
import { can } from '@templeos/core';
import { voidExpenseAction } from '@/features/expenses/actions';
import { VoidExpenseForm } from '@/features/expenses/components/void-form';
import { requireTenantContext } from '@/lib/session';
import { expenseService } from '@/lib/services';

interface ExpenseDetailProps {
  params: Promise<{ expenseId: string }>;
}

export const metadata: Metadata = { title: 'Expense' };

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cheque: 'Cheque',
  other: 'Other',
};

export default async function ExpenseDetailPage({ params }: ExpenseDetailProps) {
  const { expenseId } = await params;
  const { ctx } = await requireTenantContext();

  const result = await expenseService().getExpense(ctx, expenseId);
  if (!result.ok) notFound();
  const e = result.value;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/expenses" className="text-sm text-muted-foreground hover:text-foreground">
          ← Expenses
        </Link>
        <div className="mt-2 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Voucher {e.voucherNumber}</h1>
          <span className="text-2xl font-semibold">{formatMoney(e.amount, e.currency)}</span>
        </div>
        <Link
          href={`/expenses/${expenseId}/voucher`}
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          Print payment voucher →
        </Link>
      </div>

      {e.status === 'void' ? (
        <Alert tone="error">
          This expense was voided{e.voidReason ? ` — ${e.voidReason}` : ''}. It is excluded from
          all totals.
        </Alert>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Details</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Paid to</dt>
            <dd className="font-medium">{e.paidTo}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Method</dt>
            <dd className="font-medium">{METHOD_LABELS[e.method] ?? e.method}</dd>
          </div>
          {e.categoryName ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Category</dt>
              <dd className="font-medium">{e.categoryName}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Date</dt>
            <dd className="font-medium">
              {e.spentAt.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </dd>
          </div>
          {e.reference ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="font-medium">{e.reference}</dd>
            </div>
          ) : null}
          {e.note ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Note</dt>
              <dd className="font-medium">{e.note}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {e.status === 'recorded' && can(ctx, 'expenses:void') ? (
        <section className="rounded-xl border border-border bg-card shadow-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Void this expense</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Voiding keeps the record and voucher number for the audit trail but removes it from
            totals. This cannot be undone.
          </p>
          <div className="mt-4">
            <VoidExpenseForm action={voidExpenseAction.bind(null, expenseId)} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
