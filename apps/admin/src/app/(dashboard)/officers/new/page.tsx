import type { Metadata } from 'next';
import Link from 'next/link';
import { createOfficerAction } from '@/features/officers/actions';
import { OfficerForm } from '@/features/officers/components/officer-form';

export const metadata: Metadata = { title: 'Add office bearer' };

export default function NewOfficerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/officers" className="text-sm text-muted-foreground hover:text-foreground">
          ← Office bearers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add an office bearer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record a trustee or committee member and their term.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <OfficerForm action={createOfficerAction} submitLabel="Add office bearer" />
      </div>
    </div>
  );
}
