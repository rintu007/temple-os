import type { Metadata } from 'next';
import Link from 'next/link';
import { CampaignForm } from '@/features/campaigns/components/campaign-form';
import { requireTenantContext } from '@/lib/session';

export const metadata: Metadata = { title: 'New campaign' };

export default async function NewCampaignPage() {
  const { membership } = await requireTenantContext();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/campaigns" className="text-sm text-muted-foreground hover:text-foreground">
          ← Campaigns
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set a goal — donations earmarked to it drive the progress bar automatically.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-card p-6">
        <CampaignForm currency={membership.currency} />
      </div>
    </div>
  );
}
