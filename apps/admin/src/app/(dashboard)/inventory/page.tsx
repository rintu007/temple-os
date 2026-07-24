import type { Metadata } from 'next';
import Link from 'next/link';
import { INVENTORY_UNIT_LABELS, type InventoryUnit } from '@templeos/validators';
import { Alert, Badge, cn } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { inventoryService } from '@/lib/services';

export const metadata: Metadata = { title: 'Inventory' };

interface InventoryPageProps {
  searchParams: Promise<{ status?: string }>;
}

function fmtQty(value: string): string {
  return Number.parseFloat(value).toString();
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const { status: rawStatus } = await searchParams;
  const status = rawStatus === 'all' ? 'all' : 'active';
  const { ctx } = await requireTenantContext();

  const [result, stats] = await Promise.all([
    inventoryService().listItems(ctx, status),
    inventoryService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const items = result.value;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory & store</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track pooja supplies and prasadam-kitchen stock. Record stock in, issues, and
            stock-takes.
          </p>
        </div>
        <Link
          href="/inventory/new"
          className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
        >
          Add item
        </Link>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">Items tracked</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.itemCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">Low on stock</div>
            <div
              className={cn(
                'mt-1 text-2xl font-semibold',
                stats.value.lowStockCount > 0 && 'text-warning',
              )}
            >
              {stats.value.lowStockCount}
            </div>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No items yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add the supplies your temple stocks to start tracking their levels.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {items.map((i) => (
            <li key={i.id}>
              <Link
                href={`/inventory/${i.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {i.name}
                    {i.isLow ? <Badge variant="warning">Low</Badge> : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {i.category ? `${i.category} · ` : ''}
                    {i.reorderLevel ? `reorder at ${fmtQty(i.reorderLevel)}` : 'no reorder level'}
                  </div>
                </div>
                <div className="whitespace-nowrap text-right">
                  <span className="text-lg font-semibold tabular-nums">
                    {fmtQty(i.currentStock)}
                  </span>{' '}
                  <span className="text-sm text-muted-foreground">
                    {INVENTORY_UNIT_LABELS[i.unit as InventoryUnit]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
