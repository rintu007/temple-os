import { z } from 'zod';

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();

/** Inclusive date range; either side may be open. */
export const dateRangeSchema = z
  .object({
    from: optionalDate,
    to: optionalDate,
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'From date must be on or before the to date',
    path: ['to'],
  });
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
