import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, formatMoney } from '@templeos/ui';
import { can } from '@templeos/core';
import { voidDonationAction } from '@/features/donations/actions';
import { VoidForm } from '@/features/donations/components/void-form';
import { requireTenantContext } from '@/lib/session';
import { donationService } from '@/lib/services';

interface DonationDetailProps {
  params: Promise<{ donationId: string }>;
}

export const metadata: Metadata = { title: 'Donation' };

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  online: 'Online',
  other: 'Other',
};

export default async function DonationDetailPage({ params }: DonationDetailProps) {
  const { donationId } = await params;
  const { ctx } = await requireTenantContext();

  const result = await donationService().getDonation(ctx, donationId);
  if (!result.ok) notFound();
  const d = result.value;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/donations" className="text-sm text-muted-foreground hover:text-foreground">
          ← Donations
        </Link>
        <div className="mt-2 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Receipt #{d.receiptNumber}</h1>
          <span className="text-2xl font-semibold">{formatMoney(d.amount, d.currency)}</span>
        </div>
      </div>

      {d.status === 'void' ? (
        <Alert tone="error">
          This donation was voided{d.voidReason ? ` — ${d.voidReason}` : ''}. It is excluded from
          all totals.
        </Alert>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Details</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Donor</dt>
            <dd className="font-medium">
              {d.devoteeId ? (
                <Link href={`/devotees/${d.devoteeId}`} className="text-primary hover:underline">
                  {d.donorName}
                </Link>
              ) : (
                d.donorName
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Method</dt>
            <dd className="font-medium">{METHOD_LABELS[d.method] ?? d.method}</dd>
          </div>
          {d.categoryName ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Category</dt>
              <dd className="font-medium">{d.categoryName}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Date</dt>
            <dd className="font-medium">
              {d.donatedAt.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </dd>
          </div>
          {d.reference ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="font-medium">{d.reference}</dd>
            </div>
          ) : null}
          {d.note ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Note</dt>
              <dd className="font-medium">{d.note}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {d.status === 'recorded' && can(ctx, 'donations:void') ? (
        <section className="rounded-xl border border-border bg-card shadow-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Void this donation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Voiding keeps the record and receipt number for the audit trail but removes it from
            totals. This cannot be undone.
          </p>
          <div className="mt-4">
            <VoidForm action={voidDonationAction.bind(null, donationId)} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
