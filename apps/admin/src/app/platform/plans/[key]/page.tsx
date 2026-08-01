import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@templeos/ui';
import { updatePlanAction } from '@/features/plans/actions';
import { DeletePlanButton } from '@/features/plans/components/delete-plan-button';
import { PlanForm } from '@/features/plans/components/plan-form';
import { requirePlatformAdmin } from '@/lib/session';
import { planService } from '@/lib/services';

interface PlanDetailPageProps {
  params: Promise<{ key: string }>;
}

export const metadata: Metadata = { title: 'Plan · Platform' };

export default async function PlanDetailPage({ params }: PlanDetailPageProps) {
  const { key } = await params;
  await requirePlatformAdmin();
  const plan = await planService().getPlan(key);
  if (!plan) notFound();

  const canDelete = !plan.isTrialDefault && !plan.isFallbackDefault;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/platform/plans" className="text-sm text-muted-foreground hover:text-foreground">
          ← Plans
        </Link>
      </div>

      <PageHeader title={plan.name} description={`Key: ${plan.key}`} />

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <PlanForm action={updatePlanAction.bind(null, key)} plan={plan} submitLabel="Save changes" />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-medium text-muted-foreground">Delete plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {canDelete
            ? 'Fails if any organization is currently on this plan.'
            : "This plan is the trial or fallback default — reassign that to another plan first (in that plan's edit form)."}
        </p>
        {canDelete ? (
          <div className="mt-4">
            <DeletePlanButton planKey={key} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
