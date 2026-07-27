import { z } from 'zod';

/**
 * One entry's cleared toggle. kind distinguishes the ledger it lives in — a
 * receipt (donation), a payment (expense), or one side of an internal transfer
 * (`transfer_in` clears the destination side, `transfer_out` the source side).
 */
export const setClearedSchema = z.object({
  kind: z.enum(['receipt', 'payment', 'transfer_in', 'transfer_out']),
  entryId: z.string().uuid(),
  cleared: z.coerce.boolean(),
});
export type SetClearedInput = z.infer<typeof setClearedSchema>;

export const recordReconciliationSchema = z.object({
  statementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  statementBalance: z.coerce
    .number()
    .min(-100_000_000, 'Amount is too large')
    .max(100_000_000, 'Amount is too large'),
  note: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v === '' ? null : v))
    .nullish(),
});
export type RecordReconciliationInput = z.infer<typeof recordReconciliationSchema>;
