import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@templeos/ui';
import { createPlanAction } from '@/features/plans/actions';
import { PlanForm } from '@/features/plans/components/plan-form';
import { requirePlatformAdmin } from '@/lib/session';

export const metadata: Metadata = { title: 'New plan · Platform' };

export default async function NewPlanPage() {
  await requirePlatformAdmin();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/platform/plans" className="text-sm text-muted-foreground hover:text-foreground">
          ← Plans
        </Link>
      </div>

      <PageHeader title="New plan" />

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <PlanForm action={createPlanAction} submitLabel="Create plan" />
      </section>
    </div>
  );
}
