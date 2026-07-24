import type { Metadata } from 'next';
import Link from 'next/link';
import { createItemAction } from '@/features/inventory/actions';
import { ItemForm } from '@/features/inventory/components/item-form';

export const metadata: Metadata = { title: 'Add item' };

export default function NewInventoryItemPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/inventory" className="text-sm text-muted-foreground hover:text-foreground">
          ← Inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add an item</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create the item, then record stock movements from its page. New items start at zero
          stock.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <ItemForm action={createItemAction} submitLabel="Add item" />
      </div>
    </div>
  );
}
