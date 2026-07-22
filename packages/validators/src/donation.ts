import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const DONATION_METHODS = ['cash', 'upi', 'bank_transfer', 'card', 'online', 'other'] as const;
export type DonationMethod = (typeof DONATION_METHODS)[number];

/** Methods staff can record manually — 'online' rows come only from payment webhooks. */
export const MANUAL_DONATION_METHODS = DONATION_METHODS.filter((m) => m !== 'online');

export const recordDonationSchema = z
  .object({
    amount: z.coerce
      .number()
      .positive('Amount must be greater than zero')
      .max(100_000_000, 'Amount is too large'),
    method: z.enum(DONATION_METHODS).refine((m) => m !== 'online', {
      message: 'Online donations are recorded automatically by the payment provider',
    }),
    donorName: optionalTrimmed(120),
    devoteeId: z
      .string()
      .uuid()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v))
      .nullish(),
    categoryName: optionalTrimmed(120),
    reference: optionalTrimmed(120),
    note: optionalTrimmed(500),
    /** Optional — if given, a receipt email is sent after recording. */
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Enter a valid email address')
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v))
      .nullish(),
    donatedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v))
      .nullish(),
  })
  .refine((v) => v.donorName || v.devoteeId, {
    message: 'Select a devotee or enter a donor name',
    path: ['donorName'],
  });
export type RecordDonationInput = z.infer<typeof recordDonationSchema>;

export const donationListQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type DonationListQuery = z.infer<typeof donationListQuerySchema>;

export const voidDonationSchema = z.object({
  reason: z.string().trim().min(3, 'Give a short reason').max(300),
});
