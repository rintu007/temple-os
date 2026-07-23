import type { Metadata } from 'next';
import { DonationForm } from '@/features/donations/components/donation-form';
import { requireTenantContext } from '@/lib/session';
import { campaignService, devoteeService } from '@/lib/services';

export const metadata: Metadata = { title: 'Record donation' };

export default async function NewDonationPage() {
  const { ctx, membership } = await requireTenantContext();
  const [devotees, campaigns] = await Promise.all([
    devoteeService().listDevotees(ctx, { pageSize: 100 }),
    campaignService().listActiveOptions(ctx),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Record donation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A sequential receipt number is assigned automatically.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-card p-6">
        <DonationForm
          devotees={devotees.ok ? devotees.value.items : []}
          campaigns={campaigns.ok ? campaigns.value : []}
          currency={membership.currency}
        />
      </div>
    </div>
  );
}
