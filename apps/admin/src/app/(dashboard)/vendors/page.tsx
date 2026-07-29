import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, Button, Input, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { vendorService } from '@/lib/services';

export const metadata: Metadata = { title: 'Vendors' };

interface VendorsPageProps {
  searchParams: Promise<{ q?: string; scope?: string }>;
}

export default async function VendorsPage({ searchParams }: VendorsPageProps) {
  const { q, scope } = await searchParams;
  const { ctx } = await requireTenantContext('accounting');
  const showAll = scope === 'all';

  const [result, stats] = await Promise.all([
    vendorService().listVendors(ctx, { search: q ?? '', scope: showAll ? 'all' : 'active' }),
    vendorService().getPayablesStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const vendors = result.value;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your suppliers and their bills. Payments post straight to the expense ledger, so
            outstanding balances always match the books.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/vendors/export.csv"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <Link
            href="/vendors/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Add vendor
          </Link>
        </div>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Outstanding</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.totalOutstanding, stats.value.currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Overdue</div>
            <div
              className={cn(
                'mt-1 text-2xl font-semibold',
                Number(stats.value.overdueOutstanding) > 0 && 'text-destructive',
              )}
            >
              {formatMoney(stats.value.overdueOutstanding, stats.value.currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Open bills</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.openBillCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Active vendors</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.vendorCount}</div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action="/vendors" className="flex max-w-md flex-1 gap-2">
          {showAll ? <input type="hidden" name="scope" value="all" /> : null}
          <Input name="q" placeholder="Search by name, category or phone…" defaultValue={q ?? ''} />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <Link
          href={showAll ? '/vendors' : '/vendors?scope=all'}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? 'Active only' : 'Show inactive too'}
        </Link>
      </div>

      {vendors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">{q ? 'No matches' : 'No vendors yet'}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {q
              ? `Nothing found for “${q}”.`
              : 'Add your first supplier to start tracking bills and payments.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {vendors.map((v) => (
            <li key={v.id}>
              <Link
                href={`/vendors/${v.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  !v.isActive && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {v.name}
                    {v.category ? <Badge variant="outline">{v.category}</Badge> : null}
                    {!v.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {v.contactPerson ? `${v.contactPerson} · ` : ''}
                    {v.phone ?? v.email ?? ''}
                    {v.openBillCount > 0
                      ? `${v.contactPerson || v.phone || v.email ? ' · ' : ''}${v.openBillCount} open bill${v.openBillCount === 1 ? '' : 's'}`
                      : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {Number(v.outstanding) > 0 ? (
                    <>
                      <div className="font-semibold whitespace-nowrap">
                        {formatMoney(v.outstanding, stats.ok ? stats.value.currency : 'INR')}
                      </div>
                      <div className="text-xs text-muted-foreground">outstanding</div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Settled</span>
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
