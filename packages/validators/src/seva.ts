import { z } from 'zod';

export const SEVA_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'annual'] as const;
export type SevaFrequency = (typeof SEVA_FREQUENCIES)[number];

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

export const sevaSubscriptionSchema = z
  .object({
    sponsorName: z.string().trim().min(2, 'Enter the sponsor name').max(120),
    devoteeId: z
      .string()
      .uuid()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v))
      .nullish(),
    sevaName: z.string().trim().min(2, 'Name the seva').max(120),
    amount: z.coerce
      .number()
      .positive('Amount must be greater than zero')
      .max(100_000_000, 'Amount is too large'),
    frequency: z.enum(SEVA_FREQUENCIES),
    occasion: optionalTrimmed(120),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    endDate: optionalDate,
    note: optionalTrimmed(500),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: 'End date cannot be before the start date',
    path: ['endDate'],
  });
export type SevaSubscriptionInput = z.infer<typeof sevaSubscriptionSchema>;

export const sevaListQuerySchema = z.object({
  scope: z.enum(['active', 'all']).default('active'),
});
export type SevaListQuery = z.infer<typeof sevaListQuerySchema>;

export const SEVA_STATUSES = ['active', 'paused', 'ended'] as const;
export type SevaStatus = (typeof SEVA_STATUSES)[number];
