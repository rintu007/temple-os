import type { Db } from '@templeos/db';
import {
  budgetYearQuerySchema,
  setBudgetSchema,
  type BudgetKind,
} from '@templeos/validators';
import {
  authorize,
  conflict,
  domainError,
  err,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { financialYearOf } from '../statements/statement.service';
import { createBudgetRepository } from './budget.repository';
import type { BudgetComparison, BudgetRow, BudgetSection } from './budget.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

const paise = (v: string) => Math.round(Number(v) * 100);
const money = (minor: number) => (minor / 100).toFixed(2);

export function createBudgetService({ db }: { db: Db }) {
  const repo = createBudgetRepository(db);

  function buildSection(
    kind: BudgetKind,
    lines: Array<{ id: string; kind: BudgetKind; category: string; amount: string }>,
    actuals: Array<{ category: string; total: string }>,
  ): BudgetSection {
    const budgetByCat = new Map(
      lines.filter((l) => l.kind === kind).map((l) => [l.category, { id: l.id, amount: l.amount }]),
    );
    const actualByCat = new Map(actuals.map((a) => [a.category, a.total]));

    const categories = new Set<string>([...budgetByCat.keys(), ...actualByCat.keys()]);
    const rows: BudgetRow[] = [...categories]
      .map((category) => {
        const budgetMinor = paise(budgetByCat.get(category)?.amount ?? '0');
        const actualMinor = paise(actualByCat.get(category) ?? '0');
        return {
          id: budgetByCat.get(category)?.id ?? null,
          category,
          budget: money(budgetMinor),
          actual: money(actualMinor),
          variance: money(actualMinor - budgetMinor),
        };
      })
      .sort((a, b) => Number(b.budget) + Number(b.actual) - (Number(a.budget) + Number(a.actual)));

    const budgetTotal = rows.reduce((sum, r) => sum + paise(r.budget), 0);
    const actualTotal = rows.reduce((sum, r) => sum + paise(r.actual), 0);
    return {
      kind,
      rows,
      budgetTotal: money(budgetTotal),
      actualTotal: money(actualTotal),
      variance: money(actualTotal - budgetTotal),
    };
  }

  return {
    async getComparison(ctx: TenantContext, rawQuery: unknown): Promise<Result<BudgetComparison>> {
      const auth = authorize(ctx, 'budgets:read');
      if (!auth.ok) return auth;
      const parsed = budgetYearQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const fy = parsed.data.fy ?? financialYearOf(new Date());

      const { currency, lines, incomeActuals, expenseActuals } = await repo.comparison(ctx, fy);
      return ok({
        currency,
        financialYear: fy,
        income: buildSection('income', lines, incomeActuals),
        expense: buildSection('expense', lines, expenseActuals),
      });
    },

    async listYears(ctx: TenantContext): Promise<Result<number[]>> {
      const auth = authorize(ctx, 'budgets:read');
      if (!auth.ok) return auth;
      return ok(await repo.years(ctx));
    },

    async setBudget(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'budgets:write');
      if (!auth.ok) return auth;
      const parsed = setBudgetSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.upsert(ctx, parsed.data);
      return ok({ id });
    },

    async removeBudget(ctx: TenantContext, budgetId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'budgets:write');
      if (!auth.ok) return auth;
      const result = await repo.remove(ctx, budgetId);
      if (result.kind === 'not_found') return err(conflict('This budget line no longer exists'));
      return ok(null);
    },
  };
}

export type BudgetService = ReturnType<typeof createBudgetService>;
