import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, formatMoney } from '@templeos/ui';
import { cancelPledgeAction, fulfilPledgeAction } from '@/features/pledges/actions';
import { FulfilForm } from '@/features/pledges/components/fulfil-form';
import { requireTenantContext } from '@/lib/session';
import { pledgeService } from '@/lib/services';

interface PledgeDetailProps {
  params: Promise<{ pledgeId: string }>;
}

export const metadata: Metadata = { title: 'Pledge' };

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank',
  card: 'Card',
  online: 'Online',
  other: 'Other',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function PledgeDetailPage({ params }: PledgeDetailProps) {
  const { pledgeId } = await params;
  const { ctx } = await requireTenantContext();

  const result = await pledgeService().getPledgeDetail(ctx, pledgeId);
  if (!result.ok) notFound();
  const { pledge, fulfilments } = result.value;
  const settleable = pledge.status === 'open' && Number(pledge.outstanding) > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/pledges" className="text-sm text-muted-foreground hover:text-foreground">
          ← Pledges
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{pledge.donorName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pledged {formatMoney(pledge.amount, pledge.currency)} on {formatDate(pledge.pledgedOn)}
              {pledge.campaignTitle ? ` · ${pledge.campaignTitle}` : ''}
            </p>
          </div>
          <div className="text-right">
            {pledge.status === 'cancelled' ? (
              <Badge variant="outline">Cancelled</Badge>
            ) : pledge.progress === 'fulfilled' ? (
              <Badge variant="success">Fulfilled</Badge>
            ) : (
              <>
                <div className="text-xl font-semibold">
                  {formatMoney(pledge.outstanding, pledge.currency)}
                </div>
                <div className="text-xs text-muted-foreground">outstanding</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fulfilments */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Receipts against this pledge</h2>
          <span className="text-sm text-muted-foreground">
            {formatMoney(pledge.received, pledge.currency)} received
          </span>
        </div>

        {fulfilments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing received yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {fulfilments.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="font-medium">{f.receiptNumber}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {METHOD_LABELS[f.method] ?? f.method} ·{' '}
                    {f.donatedAt.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <span className="font-medium">{formatMoney(f.amount, pledge.currency)}</span>
              </li>
            ))}
          </ul>
        )}

        {settleable ? (
          <div className="mt-4">
            <FulfilForm
              action={fulfilPledgeAction.bind(null, pledgeId)}
              outstanding={pledge.outstanding}
            />
          </div>
        ) : null}
      </section>

      {pledge.note ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">Note</h2>
          <p className="text-sm">{pledge.note}</p>
        </section>
      ) : null}

      {/* Cancel */}
      {pledge.status === 'open' ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-sm font-medium text-muted-foreground">Cancel pledge</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Retire this pledge if it will not be pursued. Any receipts already recorded stay in the
            donation ledger.
          </p>
          <form action={cancelPledgeAction.bind(null, pledgeId)} className="mt-4">
            <Button variant="destructive" size="sm" type="submit">
              Cancel pledge
            </Button>
          </form>
        </section>
      ) : pledge.status === 'cancelled' && pledge.cancelReason ? (
        <p className="text-sm text-muted-foreground">Cancelled — {pledge.cancelReason}</p>
      ) : null}
    </div>
  );
}
