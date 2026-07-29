import type { Metadata } from 'next';
import Link from 'next/link';
import { createSevaAction } from '@/features/sevas/actions';
import { SevaForm } from '@/features/sevas/components/seva-form';
import { requireTenantContext } from '@/lib/session';
import { devoteeService } from '@/lib/services';

export const metadata: Metadata = { title: 'Add seva' };

export default async function NewSevaPage() {
  const { ctx, membership } = await requireTenantContext('worship');
  const devotees = await devoteeService().listDevotees(ctx, { pageSize: 100 });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/sevas" className="text-sm text-muted-foreground hover:text-foreground">
          ← Sevas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add seva</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register a standing seva sponsorship. Record each payment against it as it comes in — it
          joins the donation ledger automatically.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <SevaForm
          action={createSevaAction}
          devotees={devotees.ok ? devotees.value.items : []}
          currency={membership.currency}
          submitLabel="Add seva"
        />
      </section>
    </div>
  );
}
