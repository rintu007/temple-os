import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { INVENTORY_UNIT_LABELS, type InventoryUnit } from '@templeos/validators';
import { Alert, Badge, cn } from '@templeos/ui';
import { updateItemAction } from '@/features/inventory/actions';
import { ItemForm } from '@/features/inventory/components/item-form';
import { MovementForm } from '@/features/inventory/components/movement-form';
import { requireTenantContext } from '@/lib/session';
import { inventoryService } from '@/lib/services';

export const metadata: Metadata = { title: 'Item' };

interface ItemPageProps {
  params: Promise<{ itemId: string }>;
}

function fmtQty(value: string): string {
  return Number.parseFloat(value).toString();
}

const KIND_LABEL: Record<'in' | 'out' | 'adjust', string> = {
  in: 'Stock in',
  out: 'Issued',
  adjust: 'Stock-take',
};

export default async function InventoryItemPage({ params }: ItemPageProps) {
  const { itemId } = await params;
  const { ctx } = await requireTenantContext();
  const [itemResult, movementsResult] = await Promise.all([
    inventoryService().getItem(ctx, itemId),
    inventoryService().listMovements(ctx, itemId),
  ]);
  if (!itemResult.ok) {
    if (itemResult.error.code === 'NOT_FOUND') notFound();
    return <Alert tone="error">{itemResult.error.message}</Alert>;
  }
  const item = itemResult.value;
  const movements = movementsResult.ok ? movementsResult.value : [];
  const unitLabel = INVENTORY_UNIT_LABELS[item.unit as InventoryUnit];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/inventory" className="text-sm text-muted-foreground hover:text-foreground">
          ← Inventory
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
          <div className="flex items-center gap-2">
            {item.isLow ? <Badge variant="warning">Low</Badge> : null}
            <span className="text-xl font-semibold tabular-nums">
              {fmtQty(item.currentStock)}{' '}
              <span className="text-sm font-normal text-muted-foreground">{unitLabel}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-semibold">Record movement</h2>
        <div className="mt-3">
          <MovementForm itemId={itemId} unit={unitLabel} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-semibold">History</h2>
        {movements.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No movements yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={m.kind === 'in' ? 'success' : m.kind === 'out' ? 'destructive' : 'outline'}
                  >
                    {KIND_LABEL[m.kind]}
                  </Badge>
                  <span className="tabular-nums">
                    {m.kind === 'out' ? '−' : m.kind === 'in' ? '+' : '='}
                    {fmtQty(m.quantity)} {unitLabel}
                  </span>
                  {m.note ? <span className="text-muted-foreground">· {m.note}</span> : null}
                </div>
                <div className="shrink-0 text-right text-muted-foreground">
                  <span className="tabular-nums">{fmtQty(m.balanceAfter)}</span>
                  <span className="ml-2 text-xs">
                    {m.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className={cn('text-sm font-semibold')}>Edit item</h2>
        <div className="mt-3">
          <ItemForm
            action={updateItemAction.bind(null, itemId)}
            submitLabel="Save changes"
            defaults={{
              name: item.name,
              category: item.category ?? '',
              unit: item.unit,
              reorderLevel: item.reorderLevel ?? '',
              note: item.note ?? '',
            }}
          />
        </div>
      </div>
    </div>
  );
}
