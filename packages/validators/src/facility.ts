import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const facilitySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(160),
  description: optionalTrimmed(2000),
  capacity: z.coerce
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .or(z.literal(''))
    .transform((v) => (v === '' || v === 0 ? null : Number(v)))
    .nullish(),
  rentAmount: z.coerce
    .number()
    .positive('Rent must be greater than zero')
    .max(100_000_000, 'Amount is too large'),
});
export type FacilityInput = z.infer<typeof facilitySchema>;

/** Public devotee booking request. */
export const facilityBookingRequestSchema = z.object({
  facilityId: z.string().uuid(),
  bookerName: z.string().trim().min(2, 'Enter your name').max(120),
  phone: z.string().trim().min(4, 'Enter a phone number').max(20),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  purpose: optionalTrimmed(160),
  note: optionalTrimmed(500),
});
export type FacilityBookingRequestInput = z.infer<typeof facilityBookingRequestSchema>;
