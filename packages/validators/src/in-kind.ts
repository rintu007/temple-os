import { z } from 'zod';

export const IN_KIND_CATEGORIES = [
  'gold',
  'silver',
  'jewellery',
  'grain',
  'cloth',
  'other',
] as const;
export type InKindCategory = (typeof IN_KIND_CATEGORIES)[number];

export const IN_KIND_DISPOSITIONS = ['in_stock', 'sold', 'used', 'returned'] as const;
export type InKindDisposition = (typeof IN_KIND_DISPOSITIONS)[number];

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

const optionalPositive = z
  .union([z.coerce.number().nonnegative('Cannot be negative').max(1_000_000_000), z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullish();

export const inKindDonationSchema = z.object({
  donorName: z.string().trim().min(2, 'Enter the donor name').max(120),
  devoteeId: z
    .string()
    .uuid()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  category: z.enum(IN_KIND_CATEGORIES),
  item: z.string().trim().min(2, 'Describe the item').max(160),
  quantity: optionalPositive,
  unit: optionalTrimmed(30),
  estimatedValue: optionalPositive,
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  note: optionalTrimmed(500),
});
export type InKindDonationInput = z.infer<typeof inKindDonationSchema>;

export const inKindListQuerySchema = z.object({
  scope: z.enum(['in_stock', 'all']).default('all'),
});
export type InKindListQuery = z.infer<typeof inKindListQuerySchema>;

export const setDispositionSchema = z.object({
  disposition: z.enum(IN_KIND_DISPOSITIONS),
  disposalNote: optionalTrimmed(300),
});
export type SetDispositionInput = z.infer<typeof setDispositionSchema>;
