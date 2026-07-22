import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const EXPENSE_METHODS = ['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other'] as const;
export type ExpenseMethod = (typeof EXPENSE_METHODS)[number];

export const recordExpenseSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Amount must be greater than zero')
    .max(100_000_000, 'Amount is too large'),
  method: z.enum(EXPENSE_METHODS),
  paidTo: z.string().trim().min(2, 'Who was this paid to?').max(120),
  categoryName: optionalTrimmed(120),
  reference: optionalTrimmed(120),
  note: optionalTrimmed(500),
  spentOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
});
export type RecordExpenseInput = z.infer<typeof recordExpenseSchema>;

export const expenseListQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;

export const voidExpenseSchema = z.object({
  reason: z.string().trim().min(3, 'Give a short reason').max(300),
});
