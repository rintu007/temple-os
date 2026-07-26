import type { Metadata } from 'next';
import Link from 'next/link';
import { createAccountAction } from '@/features/accounts/actions';
import { AccountForm } from '@/features/accounts/components/account-form';
import { requireTenantContext } from '@/lib/session';

export const metadata: Metadata = { title: 'Add account' };

export default async function NewAccountPage() {
  const { membership } = await requireTenantContext();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/accounts" className="text-sm text-muted-foreground hover:text-foreground">
          ← Accounts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a bank account or cash box. Set the opening balance to the amount already held so the
          running balance stays accurate.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <AccountForm
          action={createAccountAction}
          currency={membership.currency}
          submitLabel="Add account"
        />
      </section>
    </div>
  );
}
