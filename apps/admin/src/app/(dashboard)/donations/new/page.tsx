import type { Metadata } from 'next';
import { DonationForm } from '@/features/donations/components/donation-form';
import { requireTenantContext } from '@/lib/session';
import { devoteeService } from '@/lib/services';

export const metadata: Metadata = { title: 'Record donation' };

export default async function NewDonationPage() {
  const { ctx, membership } = await requireTenantContext();
  const devotees = await devoteeService().listDevotees(ctx, { pageSize: 100 });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Record donation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A sequential receipt number is assigned automatically.
        </p>
      </div>
      <div className="rounded-xl border border-border p-6">
        <DonationForm
          devotees={devotees.ok ? devotees.value.items : []}
          currency={membership.currency}
        />
      </div>
    </div>
  );
}
