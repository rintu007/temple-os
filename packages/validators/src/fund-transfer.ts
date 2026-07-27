import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const fundTransferSchema = z
  .object({
    fromFundId: z.string().uuid('Choose the source fund'),
    toFundId: z.string().uuid('Choose the destination fund'),
    amount: z.coerce
      .number()
      .positive('Amount must be greater than zero')
      .max(100_000_000, 'Amount is too large'),
    transferredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    reference: optionalTrimmed(120),
    note: optionalTrimmed(300),
  })
  .refine((v) => v.fromFundId !== v.toFundId, {
    message: 'Source and destination must be different funds',
    path: ['toFundId'],
  });
export type FundTransferInput = z.infer<typeof fundTransferSchema>;
