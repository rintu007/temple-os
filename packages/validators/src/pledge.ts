import { z } from 'zod';

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

const optionalUuid = z
  .string()
  .uuid()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();

/** Manual receipt methods a pledge can be fulfilled with (no 'online' — that's the checkout flow). */
export const PLEDGE_FULFILLMENT_METHODS = ['cash', 'upi', 'bank_transfer', 'card', 'other'] as const;
export type PledgeFulfillmentMethod = (typeof PLEDGE_FULFILLMENT_METHODS)[number];

export const createPledgeSchema = z.object({
  donorName: z.string().trim().min(2, 'Who is pledging?').max(120),
  devoteeId: optionalUuid,
  campaignId: optionalUuid,
  amount: z.coerce
    .number()
    .positive('Amount must be greater than zero')
    .max(100_000_000, 'Amount is too large'),
  pledgedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  dueDate: optionalDate,
  note: optionalTrimmed(500),
});
export type CreatePledgeInput = z.infer<typeof createPledgeSchema>;

export const pledgeListQuerySchema = z.object({
  search: optionalTrimmed(120),
  scope: z.enum(['open', 'all']).default('open'),
});
export type PledgeListQuery = z.infer<typeof pledgeListQuerySchema>;

export const fulfilPledgeSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Amount must be greater than zero')
    .max(100_000_000, 'Amount is too large'),
  method: z.enum(PLEDGE_FULFILLMENT_METHODS),
  receivedOn: optionalDate,
  reference: optionalTrimmed(120),
  note: optionalTrimmed(500),
});
export type FulfilPledgeInput = z.infer<typeof fulfilPledgeSchema>;

export const cancelPledgeSchema = z.object({
  reason: z.string().trim().min(3, 'Give a short reason').max(300),
});
