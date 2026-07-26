import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatMoney } from '@templeos/ui';
import { PrintButton } from '@/components/print-button';
import { amountInWords } from '@/lib/amount-words';
import { requireTenantContext } from '@/lib/session';
import { taxService } from '@/lib/services';

interface ReceiptPageProps {
  params: Promise<{ donationId: string }>;
}

export const metadata: Metadata = { title: 'Print receipt' };

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  online: 'Online',
  other: 'Other',
};

/**
 * Print-optimized official receipt. When the org has an 80G profile, the
 * registration block prints so donors can claim their income-tax deduction.
 * The browser's Print → Save as PDF gives temples a letterhead PDF with zero
 * infrastructure; @media print strips the app chrome via the print: variants.
 */
export default async function DonationReceiptPage({ params }: ReceiptPageProps) {
  const { donationId } = await params;
  const { ctx } = await requireTenantContext();

  const result = await taxService().getReceipt(ctx, donationId);
  if (!result.ok) notFound();
  const r = result.value;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/donations/${donationId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to donation
        </Link>
        <PrintButton />
      </div>

      {r.isVoid ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm font-medium text-destructive print:border print:border-black">
          VOID — this receipt has been cancelled.
        </div>
      ) : null}

      {/* The printable document */}
      <div className="rounded-xl border border-border bg-card p-10 shadow-card print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none print:text-black">
        <header className="border-b-2 border-foreground/80 pb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {r.tax?.legalName ?? r.organizationName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground print:text-black/70">
            {r.tax ? 'Receipt for donation (u/s 80G)' : 'Donation Receipt'}
          </p>
          {r.tax ? (
            <p className="mt-1 text-xs text-muted-foreground print:text-black/60">
              80G Reg. No: {r.tax.registrationNumber}
              {r.tax.pan ? ` · PAN: ${r.tax.pan}` : ''}
            </p>
          ) : null}
        </header>

        <div className="mt-6 flex items-baseline justify-between text-sm">
          <div>
            Receipt No: <strong>{r.receiptNumber}</strong>
          </div>
          <div>
            Date:{' '}
            <strong>
              {r.donatedOn.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </strong>
          </div>
        </div>

        <dl className="mt-8 space-y-4 text-sm leading-relaxed">
          <div>
            <dt className="text-muted-foreground print:text-black/60">Received with thanks from</dt>
            <dd className="mt-0.5 border-b border-dotted border-foreground/40 pb-1 text-base font-semibold">
              {r.donorName}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground print:text-black/60">The sum of</dt>
            <dd className="mt-0.5 border-b border-dotted border-foreground/40 pb-1 font-medium">
              {amountInWords(r.amount, r.currency)}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <dt className="text-muted-foreground print:text-black/60">By</dt>
              <dd className="mt-0.5 font-medium">{METHOD_LABELS[r.method] ?? r.method}</dd>
            </div>
            {r.categoryName ? (
              <div>
                <dt className="text-muted-foreground print:text-black/60">Towards</dt>
                <dd className="mt-0.5 font-medium">{r.categoryName}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground print:text-black/60">Financial year</dt>
              <dd className="mt-0.5 font-medium">{r.financialYearLabel}</dd>
            </div>
            {r.donorPan ? (
              <div>
                <dt className="text-muted-foreground print:text-black/60">Donor PAN</dt>
                <dd className="mt-0.5 font-medium">{r.donorPan}</dd>
              </div>
            ) : null}
          </div>
        </dl>

        <div className="mt-8 flex items-end justify-between">
          <div className="rounded-lg border-2 border-foreground/80 px-5 py-2.5 text-xl font-bold tabular-nums">
            {formatMoney(r.amount, r.currency)}
          </div>
          <div className="text-center text-sm">
            <div className="w-44 border-b border-foreground/60 pb-8" />
            <div className="mt-1 text-muted-foreground print:text-black/60">
              Authorised signatory
            </div>
          </div>
        </div>

        {r.tax ? (
          <p className="mt-6 text-center text-xs text-muted-foreground print:text-black/60">
            Donations to {r.tax.legalName} are eligible for deduction under section 80G of the
            Income-tax Act, 1961
            {r.tax.validUntil ? `, vide approval valid up to ${r.tax.validUntil}` : ''}. Please
            retain this receipt for your records.
          </p>
        ) : null}

        <p className="mt-4 text-center text-xs text-muted-foreground print:text-black/50">
          This is a computer-generated receipt issued by {r.organizationName} via TempleOS.
        </p>
      </div>
    </div>
  );
}
