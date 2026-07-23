import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { hundiService } from '@/lib/services';

export const metadata: Metadata = { title: 'Hundi collections' };

export default async function HundiPage() {
  const { ctx } = await requireTenantContext();
  const result = await hundiService().listCollections(ctx);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const collections = result.value;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hundi collections</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Count each offering box by denomination. Every collection gets a receipt and joins the
            donation ledger.
          </p>
        </div>
        <Link
          href="/hundi/new"
          className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
        >
          Record collection
        </Link>
      </div>

      {collections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No collections yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Record your first hundi counting — the total is added to your donation income
            automatically.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {collections.map((c) => {
            const denomCount = c.denominations
              ? c.denominations.reduce((n, d) => n + d.count, 0)
              : 0;
            return (
              <li
                key={c.id}
                className={cn(
                  'flex items-center justify-between gap-4 p-4',
                  c.status === 'void' && 'opacity-50',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {c.boxName}
                    {c.status === 'void' ? <Badge variant="outline">VOID</Badge> : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {c.receiptNumber} ·{' '}
                    {new Date(`${c.countedOn}T12:00:00`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {denomCount > 0 ? ` · ${denomCount} notes/coins counted` : ' · total entered'}
                  </div>
                </div>
                <div className="font-semibold whitespace-nowrap">
                  {formatMoney(c.totalAmount, c.currency)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
