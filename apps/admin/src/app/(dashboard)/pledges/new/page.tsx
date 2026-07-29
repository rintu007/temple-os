import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@templeos/ui';
import { PledgeForm } from '@/features/pledges/components/pledge-form';
import { requireTenantContext } from '@/lib/session';
import { campaignService } from '@/lib/services';

export const metadata: Metadata = { title: 'Record pledge' };

export default async function NewPledgePage() {
  const { ctx } = await requireTenantContext('finance-basic');
  const campaigns = await campaignService().listActiveOptions(ctx);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/pledges" className="text-sm text-muted-foreground hover:text-foreground">
          ← Pledges
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Record pledge</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture a promised donation. Record receipts against it as the money comes in.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        {campaigns.ok ? (
          <PledgeForm campaigns={campaigns.value} />
        ) : (
          <Alert tone="error">{campaigns.error.message}</Alert>
        )}
      </section>
    </div>
  );
}
