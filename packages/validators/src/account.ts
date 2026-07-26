import { z } from 'zod';

export const ACCOUNT_TYPES = ['bank', 'cash'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const accountSchema = z
  .object({
    name: z.string().trim().min(2, 'Give the account a name').max(120),
    type: z.enum(ACCOUNT_TYPES),
    bankName: optionalTrimmed(120),
    accountNumber: optionalTrimmed(40),
    openingBalance: z.coerce
      .number()
      .min(-100_000_000, 'Amount is too large')
      .max(100_000_000, 'Amount is too large')
      .default(0),
    openingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v))
      .nullish(),
    note: optionalTrimmed(300),
  })
  .refine((v) => v.type === 'bank' || !v.accountNumber, {
    message: 'A cash box has no account number',
    path: ['accountNumber'],
  });
export type AccountInput = z.infer<typeof accountSchema>;

export const accountListQuerySchema = z.object({
  scope: z.enum(['active', 'all']).default('active'),
});
export type AccountListQuery = z.infer<typeof accountListQuerySchema>;

/** Reusable optional-account-reference field for donation/expense forms. */
export const optionalAccountId = z
  .string()
  .uuid()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();
