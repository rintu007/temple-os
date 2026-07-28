import { z } from 'zod';

export const RECURRING_DONATION_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'annual'] as const;
export type RecurringDonationFrequency = (typeof RECURRING_DONATION_FREQUENCIES)[number];

export const RECURRING_DONATION_STATUSES = ['active', 'paused', 'ended'] as const;
export type RecurringDonationStatus = (typeof RECURRING_DONATION_STATUSES)[number];

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

export const recurringDonationSchema = z
  .object({
    donorName: optionalTrimmed(120),
    devoteeId: optionalUuid,
    amount: z.coerce
      .number()
      .positive('Amount must be greater than zero')
      .max(100_000_000, 'Amount is too large'),
    frequency: z.enum(RECURRING_DONATION_FREQUENCIES),
    fundId: optionalUuid,
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    endDate: optionalDate,
    note: optionalTrimmed(500),
  })
  .refine((v) => v.donorName || v.devoteeId, {
    message: 'Select a devotee or enter a donor name',
    path: ['donorName'],
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: 'End date cannot be before the start date',
    path: ['endDate'],
  });
export type RecurringDonationInput = z.infer<typeof recurringDonationSchema>;

export const recurringDonationListQuerySchema = z.object({
  scope: z.enum(['active', 'all']).default('active'),
});
export type RecurringDonationListQuery = z.infer<typeof recurringDonationListQuerySchema>;
