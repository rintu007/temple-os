import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, formatMoney } from '@templeos/ui';
import { setSevaStatusAction, updateSevaAction } from '@/features/sevas/actions';
import { RecordPaymentForm } from '@/features/sevas/components/record-payment-form';
import { SevaForm } from '@/features/sevas/components/seva-form';
import { requireTenantContext } from '@/lib/session';
import { devoteeService, sevaService } from '@/lib/services';

interface SevaDetailProps {
  params: Promise<{ sevaId: string }>;
}

export const metadata: Metadata = { title: 'Seva' };

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function SevaDetailPage({ params }: SevaDetailProps) {
  const { sevaId } = await params;
  const { ctx, membership } = await requireTenantContext();

  const [result, devotees] = await Promise.all([
    sevaService().getSevaDetail(ctx, sevaId),
    devoteeService().listDevotees(ctx, { pageSize: 100 }),
  ]);
  if (!result.ok) notFound();
  const { seva, currency, payments } = result.value;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/sevas" className="text-sm text-muted-foreground hover:text-foreground">
          ← Sevas
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {seva.sevaName}
              <Badge variant="outline">{FREQ_LABELS[seva.frequency] ?? seva.frequency}</Badge>
              {seva.status !== 'active' ? (
                <Badge variant="outline" className="capitalize">
                  {seva.status}
                </Badge>
              ) : null}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {seva.sponsorName}
              {seva.occasion ? ` · ${seva.occasion}` : ''} · {formatMoney(seva.amount, currency)}
              /cycle
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">
              {formatMoney(seva.collected, currency)}
            </div>
            <div className="text-xs text-muted-foreground">collected</div>
          </div>
        </div>
      </div>

      {seva.nextOccurrence ? (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-3 text-sm">
          <span className="text-muted-foreground">Next occurrence: </span>
          <span className="font-semibold">{formatDate(seva.nextOccurrence)}</span>
        </div>
      ) : null}

      {seva.status === 'active' ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Record a payment</h2>
          <RecordPaymentForm sevaId={seva.id} defaultAmount={seva.amount} currency={currency} />
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold">
          Collection history
        </div>
        {payments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <Link href={`/donations/${p.id}`} className="font-medium hover:underline">
                  {p.receiptNumber}
                </Link>
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
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Seva details</h2>
        <SevaForm
          action={updateSevaAction.bind(null, sevaId)}
          seva={seva}
          devotees={devotees.ok ? devotees.value.items : []}
          currency={membership.currency}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-medium text-muted-foreground">Status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pause a seva to stop its schedule temporarily, or end it when the sponsorship is over.
          History is always kept.
        </p>
        <div className="mt-4 flex gap-2">
          {seva.status !== 'active' ? (
            <form action={setSevaStatusAction.bind(null, sevaId, 'active')}>
              <Button variant="outline" size="sm" type="submit">
                Reactivate
              </Button>
            </form>
          ) : null}
          {seva.status === 'active' ? (
            <form action={setSevaStatusAction.bind(null, sevaId, 'paused')}>
              <Button variant="outline" size="sm" type="submit">
                Pause
              </Button>
            </form>
          ) : null}
          {seva.status !== 'ended' ? (
            <form action={setSevaStatusAction.bind(null, sevaId, 'ended')}>
              <Button variant="destructive" size="sm" type="submit">
                End seva
              </Button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}
