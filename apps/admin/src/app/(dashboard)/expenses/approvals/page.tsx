import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Button, formatMoney } from '@templeos/ui';
import { approveExpenseAction, rejectExpenseAction } from '@/features/expenses/actions';
import { RejectForm } from '@/features/expenses/components/reject-form';
import { ThresholdForm } from '@/features/expenses/components/threshold-form';
import { requireTenantContext } from '@/lib/session';
import { expenseService } from '@/lib/services';

export const metadata: Metadata = { title: 'Expense approvals' };

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank',
  card: 'Card',
  cheque: 'Cheque',
  other: 'Other',
};

export default async function ApprovalsPage() {
  const { ctx } = await requireTenantContext();
  const [pending, settings] = await Promise.all([
    expenseService().listPendingApprovals(ctx),
    expenseService().getApprovalSettings(ctx),
  ]);

  if (!pending.ok) {
    return <Alert tone="error">{pending.error.message}</Alert>;
  }
  const items = pending.value;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/expenses" className="text-sm text-muted-foreground hover:text-foreground">
          ← Expenses
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Expense approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Large expenses wait here for a manager&apos;s sign-off. The voucher is already in the
          books — approval is the governance record.
        </p>
      </div>

      {settings.ok ? (
        <section className="max-w-md rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Settings</h2>
          <ThresholdForm threshold={settings.value.threshold} />
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Awaiting approval ({items.length})
        </h2>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">Nothing awaiting approval.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {items.map((e) => (
              <li key={e.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/expenses/${e.id}`} className="font-medium hover:underline">
                      {e.paidTo}
                    </Link>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {e.voucherNumber} · {METHOD_LABELS[e.method] ?? e.method}
                      {e.categoryName ? ` · ${e.categoryName}` : ''} ·{' '}
                      {e.spentAt.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="font-semibold whitespace-nowrap">
                      {formatMoney(e.amount, e.currency)}
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={approveExpenseAction.bind(null, e.id)}>
                        <Button type="submit" size="sm">
                          Approve
                        </Button>
                      </form>
                    </div>
                    <RejectForm action={rejectExpenseAction.bind(null, e.id)} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
