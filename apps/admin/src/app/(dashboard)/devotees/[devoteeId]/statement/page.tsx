import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn, formatMoney } from '@templeos/ui';
import { PrintButton } from '@/components/print-button';
import { requireTenantContext } from '@/lib/session';
import { devoteeService, donationService } from '@/lib/services';

interface StatementPageProps {
  params: Promise<{ devoteeId: string }>;
  searchParams: Promise<{ fy?: string }>;
}

export const metadata: Metadata = { title: 'Annual statement' };

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank',
  card: 'Card',
  online: 'Online',
  other: 'Other',
};

function currentFyStart(): number {
  const now = new Date();
  return now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

export default async function DevoteeStatementPage({ params, searchParams }: StatementPageProps) {
  const { devoteeId } = await params;
  const { fy } = await searchParams;
  const { ctx, membership } = await requireTenantContext();

  const current = currentFyStart();
  const parsed = Number.parseInt(fy ?? '', 10);
  const fyStartYear =
    Number.isFinite(parsed) && parsed >= current - 6 && parsed <= current ? parsed : current;

  const [devotee, statement] = await Promise.all([
    devoteeService().getDevotee(ctx, devoteeId),
    donationService().getDevoteeStatement(ctx, devoteeId, fyStartYear),
  ]);
  if (!devotee.ok || !statement.ok) notFound();
  const s = statement.value;
  const years = [current, current - 1, current - 2];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/devotees/${devoteeId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to devotee
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg border border-border p-1 text-sm">
            {years.map((y) => (
              <Link
                key={y}
                href={`/devotees/${devoteeId}/statement?fy=${y}`}
                className={cn(
                  'rounded-md px-3 py-1',
                  y === fyStartYear
                    ? 'bg-muted font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {y}–{(y + 1).toString().slice(2)}
              </Link>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-10 shadow-card print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black print:shadow-none">
        <header className="border-b-2 border-foreground/80 pb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{membership.organizationName}</h1>
          <p className="mt-1 text-sm text-muted-foreground print:text-black/70">
            Annual Donation Statement · FY {s.fyLabel}
          </p>
        </header>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <div>
            Donor: <strong>{devotee.value.fullName}</strong>
          </div>
          <div>
            Period: <strong>1 Apr {s.fyStartYear} – 31 Mar {s.fyStartYear + 1}</strong>
          </div>
        </div>

        {s.items.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground print:text-black/70">
            No donations were recorded for this devotee in FY {s.fyLabel}.
          </p>
        ) : (
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/30 text-left text-muted-foreground print:text-black/70">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Receipt</th>
                <th className="py-2 font-medium">Towards</th>
                <th className="py-2 font-medium">Method</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((d) => (
                <tr key={d.id} className="border-b border-border print:border-black/15">
                  <td className="py-2 whitespace-nowrap">
                    {d.donatedAt.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-2 whitespace-nowrap">{d.receiptNumber}</td>
                  <td className="py-2">{d.categoryName ?? '—'}</td>
                  <td className="py-2">{METHOD_LABELS[d.method] ?? d.method}</td>
                  <td className="py-2 text-right tabular-nums whitespace-nowrap">
                    {formatMoney(d.amount, membership.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/60 font-semibold">
                <td className="py-2" colSpan={4}>
                  Total ({s.count} donation{s.count === 1 ? '' : 's'})
                </td>
                <td className="py-2 text-right tabular-nums whitespace-nowrap">
                  {formatMoney(s.total, membership.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground print:text-black/50">
          This is a computer-generated statement issued by {membership.organizationName} via
          TempleOS. Please retain it for your records.
        </p>
      </div>
    </div>
  );
}
