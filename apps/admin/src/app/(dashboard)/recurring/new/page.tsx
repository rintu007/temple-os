import type { Metadata } from 'next';
import Link from 'next/link';
import { createRecurringAction } from '@/features/recurring/actions';
import { RecurringForm } from '@/features/recurring/components/recurring-form';
import { requireTenantContext } from '@/lib/session';
import { accountService } from '@/lib/services';

export const metadata: Metadata = { title: 'Add standing order' };

export default async function NewRecurringPage() {
  const { ctx, membership } = await requireTenantContext('finance-basic');
  const accounts = await accountService().listActiveOptions(ctx);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/recurring" className="text-sm text-muted-foreground hover:text-foreground">
          ← Recurring expenses
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add standing order</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define the schedule once. Record each payment from the standing order&apos;s page — it
          writes a normal expense voucher tagged back to this order.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <RecurringForm
          action={createRecurringAction}
          currency={membership.currency}
          accounts={accounts.ok ? accounts.value : []}
          submitLabel="Add standing order"
        />
      </section>
    </div>
  );
}
