import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, PageHeader } from '@templeos/ui';
import { requirePlatformAdmin } from '@/lib/session';
import { planService } from '@/lib/services';

export const metadata: Metadata = { title: 'Plans · Platform' };

export default async function PlansPage() {
  await requirePlatformAdmin();
  const plans = await planService().listPlans();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/platform" className="text-sm text-muted-foreground hover:text-foreground">
          ← Platform
        </Link>
      </div>

      <PageHeader
        title="Plans"
        description="The package catalog every org's billing page and module gating reads from."
        actions={
          <Link
            href="/platform/plans/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            New plan
          </Link>
        }
      />

      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
        {plans.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-4 p-4">
            <Link href={`/platform/plans/${p.key}`} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                {p.name}
                <span className="text-xs text-muted-foreground">({p.key})</span>
                {p.isTrialDefault ? <Badge variant="default">Trial default</Badge> : null}
                {p.isFallbackDefault ? <Badge variant="outline">Fallback default</Badge> : null}
                {p.isPurchasable ? <Badge variant="success">Purchasable</Badge> : null}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {p.priceUsd === null ? 'Not purchased directly' : p.priceUsd === 0 ? 'Free' : `$${p.priceUsd}/mo`}
                {' · '}
                {p.modules.length === 0 ? 'Core only' : p.modules.join(', ')}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
