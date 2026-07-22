import type { Metadata } from 'next';
import { createPujaTypeAction } from '@/features/pujas/actions';
import { PujaTypeForm } from '@/features/pujas/components/puja-type-form';
import { requireTenantContext } from '@/lib/session';

export const metadata: Metadata = { title: 'Add puja' };

export default async function NewPujaPage() {
  const { membership } = await requireTenantContext();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add puja</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Devotees will be able to book and pay for this puja online.
        </p>
      </div>
      <div className="rounded-xl border border-border p-6">
        <PujaTypeForm
          action={createPujaTypeAction}
          currency={membership.currency}
          submitLabel="Create puja"
        />
      </div>
    </div>
  );
}
