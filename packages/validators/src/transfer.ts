import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const transferSchema = z
  .object({
    fromAccountId: z.string().uuid('Choose the source account'),
    toAccountId: z.string().uuid('Choose the destination account'),
    amount: z.coerce
      .number()
      .positive('Amount must be greater than zero')
      .max(100_000_000, 'Amount is too large'),
    transferredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    reference: optionalTrimmed(120),
    note: optionalTrimmed(300),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    message: 'Source and destination must be different accounts',
    path: ['toAccountId'],
  });
export type TransferInput = z.infer<typeof transferSchema>;
