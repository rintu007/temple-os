import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, formatMoney } from '@templeos/ui';
import { ProgressBar } from '@/features/campaigns/components/progress-bar';
import { requireTenantContext } from '@/lib/session';
import { campaignService } from '@/lib/services';

export const metadata: Metadata = { title: 'Campaigns' };

const STATUS_VARIANT = {
  active: 'success',
  completed: 'primary',
  archived: 'outline',
} as const;

export default async function CampaignsPage() {
  const { ctx } = await requireTenantContext();
  const result = await campaignService().listCampaigns(ctx);
  if (!result.ok) return <Alert tone="error">{result.error.message}</Alert>;
  const campaigns = result.value;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fundraising goals with live progress. Active campaigns appear on your website.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
        >
          New campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No campaigns yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create a fundraising goal — renovation, festival fund, annadanam — and track donations
            towards it.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {campaigns.map((c) => {
            const percent = Math.min(
              100,
              Math.round((Number(c.raisedAmount) / Math.max(1, Number(c.goalAmount))) * 100),
            );
            return (
              <li key={c.id}>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="block rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-medium">{c.title}</h2>
                    <Badge variant={STATUS_VARIANT[c.status]} className="capitalize">
                      {c.status}
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <ProgressBar percent={percent} />
                    <div className="mt-2 flex items-baseline justify-between text-sm">
                      <span className="font-semibold">
                        {formatMoney(c.raisedAmount, c.currency)}
                      </span>
                      <span className="text-muted-foreground">
                        of {formatMoney(c.goalAmount, c.currency)} · {percent}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.donationCount} donation{c.donationCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
