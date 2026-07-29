import type { Metadata } from 'next';
import Link from 'next/link';
import { createGrantAction } from '@/features/grants/actions';
import { GrantForm } from '@/features/grants/components/grant-form';
import { requireTenantContext } from '@/lib/session';

export const metadata: Metadata = { title: 'Add grant' };

export default async function NewGrantPage() {
  const { membership } = await requireTenantContext('accounting');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/grants" className="text-sm text-muted-foreground hover:text-foreground">
          ← Grants
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add grant</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register a sanctioned grant. Tag its releases and utilizations when recording donations
          and expenses.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <GrantForm
          action={createGrantAction}
          currency={membership.currency}
          submitLabel="Add grant"
        />
      </section>
    </div>
  );
}
