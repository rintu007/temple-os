import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@templeos/ui';
import { deletePlanAction, updatePlanAction } from '@/features/membership/actions';
import { PlanForm } from '@/features/membership/components/plan-form';
import { requireTenantContext } from '@/lib/session';
import { membershipService } from '@/lib/services';

interface PlanDetailProps {
  params: Promise<{ planId: string }>;
}

export const metadata: Metadata = { title: 'Membership plan' };

export default async function PlanDetailPage({ params }: PlanDetailProps) {
  const { planId } = await params;
  const { ctx, membership } = await requireTenantContext();

  const plan = await membershipService().getPlan(ctx, planId);
  if (!plan.ok) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/membership" className="text-sm text-muted-foreground hover:text-foreground">
          ← Membership
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{plan.value.name}</h1>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Details</h2>
        <PlanForm
          action={updatePlanAction.bind(null, planId)}
          plan={plan.value}
          currency={membership.currency}
          submitLabel="Save changes"
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Duration changes apply to new joins only — existing members keep their expiry date.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="text-sm font-medium text-muted-foreground">Delete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Removes this plan from your website. Existing members are kept.
        </p>
        <form action={deletePlanAction.bind(null, planId)} className="mt-4">
          <Button variant="destructive" size="sm" type="submit">
            Delete plan
          </Button>
        </form>
      </section>
    </div>
  );
}
