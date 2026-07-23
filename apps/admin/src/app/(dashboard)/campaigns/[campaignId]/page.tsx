import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Badge, Button, formatMoney } from '@templeos/ui';
import { setCampaignStatusAction } from '@/features/campaigns/actions';
import { ProgressBar } from '@/features/campaigns/components/progress-bar';
import { requireTenantContext } from '@/lib/session';
import { campaignService } from '@/lib/services';

interface CampaignDetailProps {
  params: Promise<{ campaignId: string }>;
}

export const metadata: Metadata = { title: 'Campaign' };

const STATUS_VARIANT = {
  active: 'success',
  completed: 'primary',
  archived: 'outline',
} as const;

export default async function CampaignDetailPage({ params }: CampaignDetailProps) {
  const { campaignId } = await params;
  const { ctx } = await requireTenantContext();

  const result = await campaignService().getCampaign(ctx, campaignId);
  if (!result.ok) notFound();
  const c = result.value;
  const percent = Math.min(
    100,
    Math.round((Number(c.raisedAmount) / Math.max(1, Number(c.goalAmount))) * 100),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/campaigns" className="text-sm text-muted-foreground hover:text-foreground">
          ← Campaigns
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
          <Badge variant={STATUS_VARIANT[c.status]} className="capitalize">
            {c.status}
          </Badge>
        </div>
        {c.description ? (
          <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{c.description}</p>
        ) : null}
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <ProgressBar percent={percent} />
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-2xl font-semibold">{formatMoney(c.raisedAmount, c.currency)}</span>
          <span className="text-sm text-muted-foreground">
            of {formatMoney(c.goalAmount, c.currency)} · {percent}%
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Raised across {c.donationCount} donation{c.donationCount === 1 ? '' : 's'}.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="text-sm font-medium text-muted-foreground">Status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Active campaigns show on your public website. Mark completed when the goal is met, or
          archive to hide it.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {c.status !== 'active' ? (
            <form action={setCampaignStatusAction.bind(null, c.id, 'active')}>
              <Button size="sm" type="submit">
                Make active
              </Button>
            </form>
          ) : null}
          {c.status !== 'completed' ? (
            <form action={setCampaignStatusAction.bind(null, c.id, 'completed')}>
              <Button variant="outline" size="sm" type="submit">
                Mark completed
              </Button>
            </form>
          ) : null}
          {c.status !== 'archived' ? (
            <form action={setCampaignStatusAction.bind(null, c.id, 'archived')}>
              <Button variant="ghost" size="sm" type="submit">
                Archive
              </Button>
            </form>
          ) : null}
        </div>
      </section>

      <Alert tone="info">
        To add to this campaign, record a donation and pick it under “Campaign”, or a devotee can
        give toward it on your public site.
      </Alert>
    </div>
  );
}
