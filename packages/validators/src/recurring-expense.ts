import { z } from 'zod';

export const RECURRING_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'annual'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const RECURRING_STATUSES = ['active', 'paused', 'ended'] as const;
export type RecurringStatus = (typeof RECURRING_STATUSES)[number];

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

const optionalUuid = z
  .string()
  .uuid()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();

export const recurringExpenseSchema = z.object({
  payee: z.string().trim().min(2, 'Who is paid?').max(160),
  description: optionalTrimmed(200),
  category: optionalTrimmed(120),
  amount: z.coerce
    .number()
    .positive('Amount must be greater than zero')
    .max(100_000_000, 'Amount is too large'),
  frequency: z.enum(RECURRING_FREQUENCIES),
  accountId: optionalUuid,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  endDate: optionalDate,
  note: optionalTrimmed(500),
});
export type RecurringExpenseInput = z.infer<typeof recurringExpenseSchema>;

export const recurringExpenseListQuerySchema = z.object({
  scope: z.enum(['active', 'all']).default('active'),
});
export type RecurringExpenseListQuery = z.infer<typeof recurringExpenseListQuerySchema>;
