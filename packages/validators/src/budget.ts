import { z } from 'zod';

export const BUDGET_KINDS = ['income', 'expense'] as const;
export type BudgetKind = (typeof BUDGET_KINDS)[number];

const financialYear = z.coerce
  .number()
  .int()
  .min(2000, 'Pick a valid year')
  .max(2100, 'Pick a valid year');

export const setBudgetSchema = z.object({
  financialYear,
  kind: z.enum(BUDGET_KINDS),
  category: z.string().trim().min(1, 'Enter a category').max(120),
  amount: z.coerce
    .number()
    .nonnegative('Amount cannot be negative')
    .max(100_000_000, 'Amount is too large'),
  note: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v === '' ? null : v))
    .nullish(),
});
export type SetBudgetInput = z.infer<typeof setBudgetSchema>;

export const budgetYearQuerySchema = z.object({
  fy: financialYear.optional(),
});
