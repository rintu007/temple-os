import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, formatMoney } from '@templeos/ui';
import {
  setInvestmentStatusAction,
  updateInvestmentAction,
} from '@/features/investments/actions';
import { InvestmentForm } from '@/features/investments/components/investment-form';
import { requireTenantContext } from '@/lib/session';
import { fundService, investmentService } from '@/lib/services';

interface InvestmentDetailProps {
  params: Promise<{ investmentId: string }>;
}

export const metadata: Metadata = { title: 'Investment' };

const TYPE_LABEL: Record<string, string> = {
  fixed_deposit: 'Fixed deposit',
  recurring_deposit: 'Recurring deposit',
  bond: 'Bond',
  mutual_fund: 'Mutual fund',
  other: 'Other',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  matured: 'Matured',
  closed: 'Closed',
};

export default async function InvestmentDetailPage({ params }: InvestmentDetailProps) {
  const { investmentId } = await params;
  const { ctx, membership } = await requireTenantContext('accounting');

  const [result, funds, stats] = await Promise.all([
    investmentService().getInvestment(ctx, investmentId),
    fundService().listActiveOptions(ctx),
    investmentService().getStats(ctx),
  ]);
  if (!result.ok) notFound();
  const i = result.value;
  const currency = stats.ok ? stats.value.currency : membership.currency;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/investments" className="text-sm text-muted-foreground hover:text-foreground">
          ← Investments
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {i.institution}
              <Badge variant="outline">{TYPE_LABEL[i.type]}</Badge>
              {i.status !== 'active' ? (
                <Badge variant="outline">{STATUS_LABEL[i.status]}</Badge>
              ) : null}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {i.reference ? `${i.reference} · ` : ''}
              invested {i.investedOn}
              {i.maturityDate ? ` · matures ${i.maturityDate}` : ''}
              {i.interestRate ? ` · ${i.interestRate}% p.a.` : ''}
              {i.fundName ? ` · ${i.fundName}` : ''}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">
              {i.maturityValue
                ? formatMoney(i.maturityValue, currency)
                : formatMoney(i.principal, currency)}
            </div>
            <div className="text-xs text-muted-foreground">
              {i.maturityValue ? 'at maturity' : 'principal'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Principal', value: i.principal },
          { label: 'Maturity value', value: i.maturityValue ?? i.principal },
          { label: 'Interest earned', value: i.interestEarned ?? '0.00' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card shadow-card p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="mt-0.5 font-semibold tabular-nums">{formatMoney(s.value, currency)}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Investment details</h2>
        <InvestmentForm
          action={updateInvestmentAction.bind(null, investmentId)}
          investment={i}
          currency={membership.currency}
          funds={funds.ok ? funds.value : []}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-medium text-muted-foreground">Status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mark the holding matured when it reaches term, or closed on premature withdrawal. Either
          removes it from the active list; history is kept.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {i.status === 'active' ? (
            <>
              <form action={setInvestmentStatusAction.bind(null, investmentId, 'matured')}>
                <Button variant="outline" size="sm" type="submit">
                  Mark matured
                </Button>
              </form>
              <form action={setInvestmentStatusAction.bind(null, investmentId, 'closed')}>
                <Button variant="destructive" size="sm" type="submit">
                  Close (withdrawn)
                </Button>
              </form>
            </>
          ) : (
            <form action={setInvestmentStatusAction.bind(null, investmentId, 'active')}>
              <Button variant="outline" size="sm" type="submit">
                Reopen
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
