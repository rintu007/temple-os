import { z } from 'zod';

export const LOAN_DIRECTIONS = ['given', 'taken'] as const;
export type LoanDirection = (typeof LOAN_DIRECTIONS)[number];

export const LOAN_STATUSES = ['active', 'closed', 'written_off'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

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

export const loanSchema = z.object({
  direction: z.enum(LOAN_DIRECTIONS),
  counterparty: z.string().trim().min(2, 'Name the other party').max(160),
  employeeId: optionalUuid,
  title: optionalTrimmed(200),
  principal: z.coerce
    .number()
    .positive('Principal must be greater than zero')
    .max(1_000_000_000, 'Amount is too large'),
  interestRate: z
    .union([z.coerce.number().min(0, 'Rate cannot be negative').max(100, 'Rate looks too high'), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  disbursedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  dueOn: optionalDate,
  note: optionalTrimmed(500),
});
export type LoanInput = z.infer<typeof loanSchema>;

export const loanRepaymentSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Repayment must be greater than zero')
    .max(1_000_000_000, 'Amount is too large'),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  note: optionalTrimmed(300),
});
export type LoanRepaymentInput = z.infer<typeof loanRepaymentSchema>;

export const loanListQuerySchema = z.object({
  scope: z.enum(['active', 'all']).default('active'),
});
export type LoanListQuery = z.infer<typeof loanListQuerySchema>;
