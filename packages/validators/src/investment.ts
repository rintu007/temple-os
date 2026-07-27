import { z } from 'zod';

export const INVESTMENT_TYPES = [
  'fixed_deposit',
  'recurring_deposit',
  'bond',
  'mutual_fund',
  'other',
] as const;
export type InvestmentType = (typeof INVESTMENT_TYPES)[number];

export const INVESTMENT_STATUSES = ['active', 'matured', 'closed'] as const;
export type InvestmentStatus = (typeof INVESTMENT_STATUSES)[number];

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();

const optionalUuid = z
  .string()
  .uuid()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();

const optionalAmount = z
  .union([z.coerce.number().nonnegative('Amount cannot be negative').max(1_000_000_000), z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullish();

export const investmentSchema = z.object({
  institution: z.string().trim().min(2, 'Name the bank or institution').max(160),
  type: z.enum(INVESTMENT_TYPES),
  fundId: optionalUuid,
  reference: optionalTrimmed(120),
  principal: z.coerce
    .number()
    .positive('Principal must be greater than zero')
    .max(1_000_000_000, 'Amount is too large'),
  interestRate: z
    .union([z.coerce.number().min(0, 'Rate cannot be negative').max(100, 'Rate looks too high'), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  investedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  maturityDate: optionalDate,
  maturityValue: optionalAmount,
  note: optionalTrimmed(500),
});
export type InvestmentInput = z.infer<typeof investmentSchema>;

export const investmentListQuerySchema = z.object({
  scope: z.enum(['active', 'all']).default('active'),
});
export type InvestmentListQuery = z.infer<typeof investmentListQuerySchema>;
