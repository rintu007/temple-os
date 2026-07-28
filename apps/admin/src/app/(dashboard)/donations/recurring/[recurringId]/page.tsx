import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, cn, formatMoney } from '@templeos/ui';
import {
  setRecurringDonationStatusAction,
  updateRecurringDonationAction,
} from '@/features/recurring-donations/actions';
import { RecordPaymentForm } from '@/features/recurring-donations/components/record-payment-form';
import { RecurringDonationForm } from '@/features/recurring-donations/components/recurring-donation-form';
import { requireTenantContext } from '@/lib/session';
import { devoteeService, fundService, recurringDonationService } from '@/lib/services';

interface RecurringDonationDetailProps {
  params: Promise<{ recurringId: string }>;
}

export const metadata: Metadata = { title: 'Standing gift' };

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  ended: 'Ended',
};

export default async function RecurringDonationDetailPage({
  params,
}: RecurringDonationDetailProps) {
  const { recurringId } = await params;
  const { ctx, membership } = await requireTenantContext();

  const [result, devotees, funds] = await Promise.all([
    recurringDonationService().getDetail(ctx, recurringId),
    devoteeService().listDevotees(ctx, { pageSize: 100 }),
    fundService().listActiveOptions(ctx),
  ]);
  if (!result.ok) notFound();
  const { recurring: r, currency, payments } = result.value;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = r.nextDue != null && r.nextDue < today;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/donations/recurring"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Recurring donations
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {r.donorName}
              <Badge variant="outline">{FREQUENCY_LABEL[r.frequency]}</Badge>
              {r.status !== 'active' ? (
                <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
              ) : null}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {r.fundName ? `${r.fundName} · ` : ''}
              {r.nextDue ? (
                <span className={cn(overdue && 'font-medium text-destructive')}>
                  {overdue ? 'overdue since ' : 'next due '}
                  {r.nextDue}
                </span>
              ) : (
                'no upcoming date'
              )}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">
              {formatMoney(r.amount, currency)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatMoney(r.givenTotal, currency)} given to date
            </div>
          </div>
        </div>
      </div>

      {r.status === 'active' ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Record a gift</h2>
          <RecordPaymentForm recurringId={recurringId} currency={currency} defaultAmount={r.amount} />
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold">
          Giving history ({payments.length})
        </div>
        {payments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No gifts recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
              >
                <Link href={`/donations/${p.id}`} className="font-medium hover:underline">
                  {p.receiptNumber}
                </Link>
                <div className="flex items-center gap-3">
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
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Standing gift details</h2>
        <RecurringDonationForm
          action={updateRecurringDonationAction.bind(null, recurringId)}
          recurring={r}
          devotees={devotees.ok ? devotees.value.items : []}
          funds={funds.ok ? funds.value : []}
          currency={membership.currency}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-medium text-muted-foreground">Status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pause a standing gift to stop it appearing in reminders without losing its history, or end
          it for good.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {r.status === 'active' ? (
            <>
              <form action={setRecurringDonationStatusAction.bind(null, recurringId, 'paused')}>
                <Button variant="outline" size="sm" type="submit">
                  Pause
                </Button>
              </form>
              <form action={setRecurringDonationStatusAction.bind(null, recurringId, 'ended')}>
                <Button variant="destructive" size="sm" type="submit">
                  End
                </Button>
              </form>
            </>
          ) : (
            <form action={setRecurringDonationStatusAction.bind(null, recurringId, 'active')}>
              <Button variant="outline" size="sm" type="submit">
                Resume
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
