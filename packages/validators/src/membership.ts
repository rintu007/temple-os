import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const membershipPlanSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(160),
  description: optionalTrimmed(2000),
  price: z.coerce
    .number()
    .positive('Price must be greater than zero')
    .max(10_000_000, 'Price is too large'),
  durationMonths: z.coerce
    .number()
    .int('Duration must be whole months')
    .min(1, 'Duration must be at least 1 month')
    .max(1200, 'Duration is too long'),
  isActive: z.boolean().default(true),
});
export type MembershipPlanInput = z.infer<typeof membershipPlanSchema>;

/** Public join checkout — devotee-facing, no signed-in user. */
export const joinMembershipSchema = z.object({
  planId: z.string().uuid(),
  memberName: z.string().trim().min(2, 'Enter your name').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  phone: optionalTrimmed(20),
});
export type JoinMembershipInput = z.infer<typeof joinMembershipSchema>;
