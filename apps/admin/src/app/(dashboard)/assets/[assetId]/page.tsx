import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Badge } from '@templeos/ui';
import { updateAssetAction } from '@/features/assets/actions';
import { AssetForm } from '@/features/assets/components/asset-form';
import { DisposeForm } from '@/features/assets/components/dispose-form';
import { requireTenantContext } from '@/lib/session';
import { assetService } from '@/lib/services';

export const metadata: Metadata = { title: 'Asset' };

interface AssetPageProps {
  params: Promise<{ assetId: string }>;
}

export default async function AssetPage({ params }: AssetPageProps) {
  const { assetId } = await params;
  const { ctx, membership } = await requireTenantContext();
  const result = await assetService().getAsset(ctx, assetId);
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const asset = result.value;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/assets" className="text-sm text-muted-foreground hover:text-foreground">
          ← Assets
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
          {asset.status === 'disposed' ? <Badge variant="outline">DISPOSED</Badge> : null}
        </div>
      </div>

      {asset.status === 'disposed' ? (
        <Alert tone="info">
          This asset was disposed{asset.disposalReason ? `: ${asset.disposalReason}` : ''}. It stays
          in the register for audit history.
        </Alert>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <AssetForm
          action={updateAssetAction.bind(null, assetId)}
          currency={membership.currency}
          submitLabel="Save changes"
          defaults={{
            name: asset.name,
            category: asset.category,
            description: asset.description ?? '',
            quantity: asset.quantity,
            estimatedValue: asset.estimatedValue ?? '',
            acquiredOn: asset.acquiredOn ?? '',
            location: asset.location ?? '',
            note: asset.note ?? '',
          }}
        />
      </div>

      {asset.status === 'active' ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-sm font-semibold">Dispose</h2>
          <div className="mt-3">
            <DisposeForm assetId={assetId} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
