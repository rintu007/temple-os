import type { Metadata } from 'next';
import Link from 'next/link';
import { recordInKindAction } from '@/features/in-kind/actions';
import { InKindForm } from '@/features/in-kind/components/in-kind-form';
import { requireTenantContext } from '@/lib/session';
import { devoteeService } from '@/lib/services';

export const metadata: Metadata = { title: 'Record offering' };

export default async function NewInKindPage() {
  const { ctx, membership } = await requireTenantContext();
  const devotees = await devoteeService().listDevotees(ctx, { pageSize: 100 });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/in-kind" className="text-sm text-muted-foreground hover:text-foreground">
          ← In-kind offerings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Record offering</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record a non-cash offering. Add an indicative valuation for the audit trail.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <InKindForm
          action={recordInKindAction}
          devotees={devotees.ok ? devotees.value.items : []}
          currency={membership.currency}
          submitLabel="Record offering"
        />
      </section>
    </div>
  );
}
