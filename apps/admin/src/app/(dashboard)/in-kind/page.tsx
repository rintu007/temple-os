import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { inKindService } from '@/lib/services';

export const metadata: Metadata = { title: 'In-kind offerings' };

interface InKindPageProps {
  searchParams: Promise<{ scope?: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  gold: 'Gold',
  silver: 'Silver',
  jewellery: 'Jewellery',
  grain: 'Grain',
  cloth: 'Cloth',
  other: 'Other',
};

const DISPOSITION_LABELS: Record<string, string> = {
  in_stock: 'In stock',
  sold: 'Sold',
  used: 'Used',
  returned: 'Returned',
};

function formatQty(q: string | null, unit: string | null) {
  if (!q) return null;
  return `${q}${unit ? ` ${unit}` : ''}`;
}

export default async function InKindPage({ searchParams }: InKindPageProps) {
  const { scope } = await searchParams;
  const { ctx } = await requireTenantContext();
  const inStockOnly = scope !== 'all';

  const [result, stats] = await Promise.all([
    inKindService().listInKind(ctx, { scope: inStockOnly ? 'in_stock' : 'all' }),
    inKindService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const offerings = result.value;
  const currency = stats.ok ? stats.value.currency : 'INR';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">In-kind offerings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Non-cash offerings — gold, silver, jewellery, grain, cloth. Recorded for audit and
            transparency, kept out of the money ledger, with an indicative valuation.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/in-kind/export.csv"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <Link
            href="/in-kind/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Record offering
          </Link>
        </div>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Value in stock</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.inStockValue, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Items in stock</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.inStockCount}</div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Link
          href={inStockOnly ? '/in-kind?scope=all' : '/in-kind'}
          className="text-sm text-primary hover:underline"
        >
          {inStockOnly ? 'Show all (incl. disposed)' : 'In stock only'}
        </Link>
      </div>

      {offerings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No offerings recorded</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Record gold, silver and other non-cash offerings here so they are on the books.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {offerings.map((o) => (
            <li key={o.id}>
              <Link
                href={`/in-kind/${o.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  o.disposition !== 'in_stock' && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {o.item}
                    <Badge variant="outline">{CATEGORY_LABELS[o.category] ?? o.category}</Badge>
                    {o.disposition !== 'in_stock' ? (
                      <Badge variant="outline">
                        {DISPOSITION_LABELS[o.disposition] ?? o.disposition}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {o.donorName}
                    {formatQty(o.quantity, o.unit) ? ` · ${formatQty(o.quantity, o.unit)}` : ''}
                    {' · '}
                    {o.receivedOn}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {o.estimatedValue ? (
                    <>
                      <div className="font-semibold whitespace-nowrap tabular-nums">
                        {formatMoney(o.estimatedValue, currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">est. value</div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">unvalued</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
