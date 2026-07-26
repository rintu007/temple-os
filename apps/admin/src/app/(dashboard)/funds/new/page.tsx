import type { Metadata } from 'next';
import Link from 'next/link';
import { createFundAction } from '@/features/funds/actions';
import { FundForm } from '@/features/funds/components/fund-form';

export const metadata: Metadata = { title: 'Add fund' };

export default function NewFundPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/funds" className="text-sm text-muted-foreground hover:text-foreground">
          ← Funds
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add fund</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create an earmarked fund. You can then assign donations and expenses to it as you record
          them.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <FundForm action={createFundAction} submitLabel="Add fund" />
      </section>
    </div>
  );
}
