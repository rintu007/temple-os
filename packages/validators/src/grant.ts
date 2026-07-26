import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const grantSchema = z.object({
  funder: z.string().trim().min(2, 'Enter the awarding body').max(160),
  title: z.string().trim().min(2, 'Enter the grant/scheme title').max(200),
  reference: optionalTrimmed(120),
  sanctionedAmount: z.coerce
    .number()
    .positive('Sanctioned amount must be greater than zero')
    .max(1_000_000_000, 'Amount is too large'),
  sanctionedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  purpose: optionalTrimmed(500),
  note: optionalTrimmed(500),
});
export type GrantInput = z.infer<typeof grantSchema>;

export const grantListQuerySchema = z.object({
  scope: z.enum(['active', 'all']).default('active'),
});
export type GrantListQuery = z.infer<typeof grantListQuerySchema>;

/** Reusable optional-grant-reference field for donation/expense forms. */
export const optionalGrantId = z
  .string()
  .uuid()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();
