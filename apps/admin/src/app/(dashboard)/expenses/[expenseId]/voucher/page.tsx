import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatMoney } from '@templeos/ui';
import { PrintButton } from '@/components/print-button';
import { amountInWords } from '@/lib/amount-words';
import { requireTenantContext } from '@/lib/session';
import { expenseService } from '@/lib/services';

interface VoucherPageProps {
  params: Promise<{ expenseId: string }>;
}

export const metadata: Metadata = { title: 'Print voucher' };

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cheque: 'Cheque',
  other: 'Other',
};

/** Print-optimized payment voucher — the outgoing twin of the donation receipt. */
export default async function ExpenseVoucherPage({ params }: VoucherPageProps) {
  const { expenseId } = await params;
  const { ctx, membership } = await requireTenantContext();

  const result = await expenseService().getExpense(ctx, expenseId);
  if (!result.ok) notFound();
  const e = result.value;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/expenses/${expenseId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to expense
        </Link>
        <PrintButton />
      </div>

      {e.status === 'void' ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm font-medium text-destructive print:border print:border-black">
          VOID — this voucher has been cancelled{e.voidReason ? `: ${e.voidReason}` : ''}.
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-10 shadow-card print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none print:text-black">
        <header className="border-b-2 border-foreground/80 pb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{membership.organizationName}</h1>
          <p className="mt-1 text-sm text-muted-foreground print:text-black/70">Payment Voucher</p>
        </header>

        <div className="mt-6 flex items-baseline justify-between text-sm">
          <div>
            Voucher No: <strong>{e.voucherNumber}</strong>
          </div>
          <div>
            Date:{' '}
            <strong>
              {e.spentAt.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </strong>
          </div>
        </div>

        <dl className="mt-8 space-y-4 text-sm leading-relaxed">
          <div>
            <dt className="text-muted-foreground print:text-black/60">Paid to</dt>
            <dd className="mt-0.5 border-b border-dotted border-foreground/40 pb-1 text-base font-semibold">
              {e.paidTo}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground print:text-black/60">The sum of</dt>
            <dd className="mt-0.5 border-b border-dotted border-foreground/40 pb-1 font-medium">
              {amountInWords(e.amount, e.currency)}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <dt className="text-muted-foreground print:text-black/60">By</dt>
              <dd className="mt-0.5 font-medium">
                {METHOD_LABELS[e.method] ?? e.method}
                {e.reference ? ` — ${e.reference}` : ''}
              </dd>
            </div>
            {e.categoryName ? (
              <div>
                <dt className="text-muted-foreground print:text-black/60">Towards</dt>
                <dd className="mt-0.5 font-medium">{e.categoryName}</dd>
              </div>
            ) : null}
          </div>
          {e.note ? (
            <div>
              <dt className="text-muted-foreground print:text-black/60">Note</dt>
              <dd className="mt-0.5 font-medium">{e.note}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-8 flex items-end justify-between">
          <div className="rounded-lg border-2 border-foreground/80 px-5 py-2.5 text-xl font-bold tabular-nums">
            {formatMoney(e.amount, e.currency)}
          </div>
          <div className="flex gap-10 text-center text-sm">
            <div>
              <div className="w-36 border-b border-foreground/60 pb-8" />
              <div className="mt-1 text-muted-foreground print:text-black/60">Received by</div>
            </div>
            <div>
              <div className="w-36 border-b border-foreground/60 pb-8" />
              <div className="mt-1 text-muted-foreground print:text-black/60">
                Authorised signatory
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground print:text-black/50">
          This is a computer-generated voucher issued by {membership.organizationName} via
          TempleOS.
        </p>
      </div>
    </div>
  );
}
