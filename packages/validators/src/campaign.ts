import { z } from 'zod';

export const campaignSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(160),
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  goalAmount: z.coerce
    .number()
    .positive('Goal must be greater than zero')
    .max(1_000_000_000, 'Goal is too large'),
});
export type CampaignInput = z.infer<typeof campaignSchema>;

export const CAMPAIGN_STATUSES = ['active', 'completed', 'archived'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
