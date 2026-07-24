import type { Metadata } from 'next';
import Link from 'next/link';
import { ASSET_CATEGORY_LABELS, type AssetCategory } from '@templeos/validators';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { assetService } from '@/lib/services';

export const metadata: Metadata = { title: 'Assets' };

interface AssetsPageProps {
  searchParams: Promise<{ status?: string }>;
}

const STATUS_TABS = ['active', 'disposed', 'all'] as const;

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const { status: rawStatus } = await searchParams;
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? (rawStatus as (typeof STATUS_TABS)[number])
    : 'active';
  const { ctx } = await requireTenantContext();

  const [result, stats] = await Promise.all([
    assetService().listAssets(ctx, status),
    assetService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const items = result.value;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assets & valuables</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The temple&apos;s register of jewellery, vessels, idols, land and more — for audit and
            insurance. Items are disposed, never deleted.
          </p>
        </div>
        <Link
          href="/assets/new"
          className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
        >
          Add asset
        </Link>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">Active assets</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.activeCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">Estimated value (active)</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.activeValue, stats.value.currency)}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex w-fit gap-1 rounded-lg border border-border p-1 text-sm">
        {STATUS_TABS.map((s) => (
          <Link
            key={s}
            href={`/assets?status=${s}`}
            className={cn(
              'rounded-md px-4 py-1.5 capitalize',
              status === s ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No {status === 'all' ? '' : status} assets</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add your temple&apos;s valuables to build an audit-ready register.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                href={`/assets/${a.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  a.status === 'disposed' && 'opacity-50',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {a.name}
                    {a.quantity > 1 ? (
                      <span className="text-sm text-muted-foreground">×{a.quantity}</span>
                    ) : null}
                    {a.status === 'disposed' ? <Badge variant="outline">DISPOSED</Badge> : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {ASSET_CATEGORY_LABELS[a.category as AssetCategory]}
                    {a.location ? ` · ${a.location}` : ''}
                  </div>
                </div>
                <div className="whitespace-nowrap text-right text-sm">
                  {a.estimatedValue ? (
                    <span className="font-semibold">
                      {formatMoney(a.estimatedValue, a.currency)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
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
