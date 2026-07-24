import type { Metadata } from 'next';
import Link from 'next/link';
import { PrasadamForm } from '@/features/prasadam/components/prasadam-form';
import { requireTenantContext } from '@/lib/session';

export const metadata: Metadata = { title: 'Record serving' };

export default async function NewPrasadamPage() {
  const { membership } = await requireTenantContext();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/prasadam" className="text-sm text-muted-foreground hover:text-foreground">
          ← Annadanam
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Record a serving</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log how many were served, and note a sponsor if the seva was sponsored.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <PrasadamForm currency={membership.currency} />
      </div>
    </div>
  );
}
