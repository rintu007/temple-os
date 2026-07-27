import type { Metadata } from 'next';
import Link from 'next/link';
import { createInvestmentAction } from '@/features/investments/actions';
import { InvestmentForm } from '@/features/investments/components/investment-form';
import { requireTenantContext } from '@/lib/session';
import { fundService } from '@/lib/services';

export const metadata: Metadata = { title: 'Add investment' };

export default async function NewInvestmentPage() {
  const { ctx, membership } = await requireTenantContext();
  const funds = await fundService().listActiveOptions(ctx);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/investments" className="text-sm text-muted-foreground hover:text-foreground">
          ← Investments
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add investment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record a fixed deposit, bond or fund. Enter the maturity value from the receipt and the
          interest earned is worked out for you.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <InvestmentForm
          action={createInvestmentAction}
          currency={membership.currency}
          funds={funds.ok ? funds.value : []}
          submitLabel="Add investment"
        />
      </section>
    </div>
  );
}
