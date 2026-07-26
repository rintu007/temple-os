import type { Metadata } from 'next';
import { financialYearOf, financialYearRange, type BudgetSection } from '@templeos/core';
import { Alert, Button, cn, formatMoney } from '@templeos/ui';
import { removeBudgetAction } from '@/features/budgets/actions';
import { BudgetForm } from '@/features/budgets/components/budget-form';
import { requireTenantContext } from '@/lib/session';
import { budgetService } from '@/lib/services';

export const metadata: Metadata = { title: 'Budgets' };

interface BudgetsPageProps {
  searchParams: Promise<{ fy?: string }>;
}

function SectionTable({
  section,
  currency,
  fy,
}: {
  section: BudgetSection;
  currency: 'INR' | 'BDT';
  fy: number;
}) {
  const isIncome = section.kind === 'income';
  const label = isIncome ? 'Income' : 'Expenditure';

  // For income a shortfall is unfavourable; for expense an overspend is.
  const varianceTone = (variance: string) => {
    const v = Number(variance);
    if (v === 0) return 'text-muted-foreground';
    const favourable = isIncome ? v > 0 : v < 0;
    return favourable ? 'text-success' : 'text-destructive';
  };
  const fmtVariance = (variance: string) => {
    const v = Number(variance);
    const sign = v > 0 ? '+' : '';
    return `${sign}${formatMoney(variance, currency)}`;
  };

  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-3 text-sm font-semibold">{label}</div>
      {section.rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          No {label.toLowerCase()} budgeted or recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th className="px-5 py-2 font-medium">Category</th>
                <th className="px-5 py-2 text-right font-medium">Budget</th>
                <th className="px-5 py-2 text-right font-medium">Actual</th>
                <th className="px-5 py-2 text-right font-medium">Variance</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {section.rows.map((r) => (
                <tr key={`${section.kind}-${r.category}`} className="border-b border-border/60">
                  <td className="px-5 py-2">{r.category}</td>
                  <td className="px-5 py-2 text-right tabular-nums">
                    {formatMoney(r.budget, currency)}
                  </td>
                  <td className="px-5 py-2 text-right tabular-nums">
                    {formatMoney(r.actual, currency)}
                  </td>
                  <td className={cn('px-5 py-2 text-right tabular-nums', varianceTone(r.variance))}>
                    {fmtVariance(r.variance)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {r.id ? (
                      <form action={removeBudgetAction.bind(null, r.id, fy)}>
                        <button
                          type="submit"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          title="Remove budget line"
                        >
                          ✕
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="px-5 py-2.5">Total</td>
                <td className="px-5 py-2.5 text-right tabular-nums">
                  {formatMoney(section.budgetTotal, currency)}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums">
                  {formatMoney(section.actualTotal, currency)}
                </td>
                <td className={cn('px-5 py-2.5 text-right tabular-nums', varianceTone(section.variance))}>
                  {fmtVariance(section.variance)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function BudgetsPage({ searchParams }: BudgetsPageProps) {
  const params = await searchParams;
  const { ctx } = await requireTenantContext();
  const currentFy = financialYearOf(new Date());
  const fy = Number.isFinite(Number(params.fy)) && params.fy ? Number(params.fy) : currentFy;

  const result = await budgetService().getComparison(ctx, { fy });
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const cmp = result.value;
  const categories = [
    ...new Set([...cmp.income.rows, ...cmp.expense.rows].map((r) => r.category)),
  ].sort();
  const fyOptions = Array.from({ length: 5 }, (_, i) => currentFy - i);
  const netBudget = (Number(cmp.income.budgetTotal) - Number(cmp.expense.budgetTotal)).toFixed(2);
  const netActual = (Number(cmp.income.actualTotal) - Number(cmp.expense.actualTotal)).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan by category for the year and track it live against the ledger.
          </p>
        </div>
        <form action="/budgets" className="flex items-end gap-2">
          <div className="space-y-1.5">
            <label htmlFor="fy" className="text-sm font-medium">
              Financial year
            </label>
            <select
              id="fy"
              name="fy"
              defaultValue={String(fy)}
              className="h-9.5 rounded-lg border border-input bg-card px-3 text-sm"
            >
              {fyOptions.map((y) => (
                <option key={y} value={y}>
                  {financialYearRange(y).label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="outline">
            View
          </Button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card shadow-card p-5">
          <div className="text-sm text-muted-foreground">Budgeted surplus/deficit</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoney(netBudget, cmp.currency)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-card p-5">
          <div className="text-sm text-muted-foreground">Actual so far</div>
          <div
            className={cn(
              'mt-1 text-2xl font-semibold',
              Number(netActual) < 0 && 'text-destructive',
            )}
          >
            {formatMoney(netActual, cmp.currency)}
          </div>
        </div>
      </div>

      <SectionTable section={cmp.income} currency={cmp.currency} fy={fy} />
      <SectionTable section={cmp.expense} currency={cmp.currency} fy={fy} />

      <details className="rounded-xl border border-border bg-card p-6 shadow-card">
        <summary className="cursor-pointer list-none text-sm font-medium text-primary hover:underline">
          + Set a budget for {financialYearRange(fy).label}
        </summary>
        <div className="mt-4">
          <BudgetForm financialYear={fy} categories={categories} />
        </div>
      </details>
    </div>
  );
}
