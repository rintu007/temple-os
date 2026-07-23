import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const volunteerOpportunitySchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(160),
  description: optionalTrimmed(2000),
  servingOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  slotsNeeded: z.coerce.number().int().min(0).max(100000).default(0),
});
export type VolunteerOpportunityInput = z.infer<typeof volunteerOpportunitySchema>;

/** Public devotee sign-up. */
export const volunteerSignupSchema = z.object({
  opportunityId: z.string().uuid(),
  name: z.string().trim().min(2, 'Enter your name').max(120),
  phone: optionalTrimmed(20),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  note: optionalTrimmed(500),
});
export type VolunteerSignupInput = z.infer<typeof volunteerSignupSchema>;
