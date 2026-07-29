import type { BudgetKind } from '@templeos/validators';

export interface BudgetRow {
  /** Budget line id, or null for a category that has actuals but no budget set. */
  id: string | null;
  category: string;
  budget: string;
  actual: string;
  /** actual − budget. Read against `kind`: for expense, positive is overspend. */
  variance: string;
}

export interface BudgetSection {
  kind: BudgetKind;
  rows: BudgetRow[];
  budgetTotal: string;
  actualTotal: string;
  variance: string;
}

export interface BudgetComparison {
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  financialYear: number;
  income: BudgetSection;
  expense: BudgetSection;
}

export type { BudgetKind };
