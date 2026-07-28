import type { Metadata } from 'next';
import Link from 'next/link';
import { createRecurringDonationAction } from '@/features/recurring-donations/actions';
import { RecurringDonationForm } from '@/features/recurring-donations/components/recurring-donation-form';
import { requireTenantContext } from '@/lib/session';
import { devoteeService, fundService } from '@/lib/services';

export const metadata: Metadata = { title: 'Add standing gift' };

export default async function NewRecurringDonationPage() {
  const { ctx, membership } = await requireTenantContext();
  const [devotees, funds] = await Promise.all([
    devoteeService().listDevotees(ctx, { pageSize: 100 }),
    fundService().listActiveOptions(ctx),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/donations/recurring"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Recurring donations
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add standing gift</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define the schedule once. Record each gift from the standing order&apos;s page — it writes
          a normal donation receipt tagged back to this order.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <RecurringDonationForm
          action={createRecurringDonationAction}
          devotees={devotees.ok ? devotees.value.items : []}
          funds={funds.ok ? funds.value : []}
          currency={membership.currency}
          submitLabel="Add standing gift"
        />
      </section>
    </div>
  );
}
