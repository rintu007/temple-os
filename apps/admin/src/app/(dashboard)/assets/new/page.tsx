import type { Metadata } from 'next';
import Link from 'next/link';
import { createAssetAction } from '@/features/assets/actions';
import { AssetForm } from '@/features/assets/components/asset-form';
import { requireTenantContext } from '@/lib/session';

export const metadata: Metadata = { title: 'Add asset' };

export default async function NewAssetPage() {
  const { membership } = await requireTenantContext();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/assets" className="text-sm text-muted-foreground hover:text-foreground">
          ← Assets
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add an asset</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record a valuable in the temple register for audit and insurance.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <AssetForm action={createAssetAction} currency={membership.currency} submitLabel="Add asset" />
      </div>
    </div>
  );
}
