import type { Metadata } from 'next';
import { createPlanAction } from '@/features/membership/actions';
import { PlanForm } from '@/features/membership/components/plan-form';
import { requireTenantContext } from '@/lib/session';

export const metadata: Metadata = { title: 'Add membership plan' };

export default async function NewPlanPage() {
  const { membership } = await requireTenantContext();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add membership plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Devotees pay once and stay members for the plan duration.
        </p>
      </div>
      <div className="rounded-xl border border-border p-6">
        <PlanForm
          action={createPlanAction}
          currency={membership.currency}
          submitLabel="Create plan"
        />
      </div>
    </div>
  );
}
