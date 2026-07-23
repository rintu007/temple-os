import type { Metadata } from 'next';
import Link from 'next/link';
import { HundiForm } from '@/features/hundi/components/hundi-form';
import { requireTenantContext } from '@/lib/session';

export const metadata: Metadata = { title: 'Record hundi collection' };

export default async function NewHundiCollectionPage() {
  const { membership } = await requireTenantContext();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/hundi" className="text-sm text-muted-foreground hover:text-foreground">
          ← Hundi collections
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Record a hundi collection</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Count the offering box by denomination. A receipt is assigned and the total joins the
          donation ledger automatically.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <HundiForm currency={membership.currency} />
      </div>
    </div>
  );
}
