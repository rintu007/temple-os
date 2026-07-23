import type { Metadata } from 'next';
import Link from 'next/link';
import { OpportunityForm } from '@/features/volunteers/components/opportunity-form';

export const metadata: Metadata = { title: 'New opportunity' };

export default function NewOpportunityPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/volunteers" className="text-sm text-muted-foreground hover:text-foreground">
          ← Volunteers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New opportunity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Devotees can sign up for this from your public site while it stays open.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-card p-6">
        <OpportunityForm />
      </div>
    </div>
  );
}
