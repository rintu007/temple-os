import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const pujaTypeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(160),
  description: optionalTrimmed(2000),
  price: z.coerce
    .number()
    .positive('Price must be greater than zero')
    .max(10_000_000, 'Price is too large'),
  isActive: z.boolean().default(true),
});
export type PujaTypeInput = z.infer<typeof pujaTypeSchema>;

/** Public booking checkout — devotee-facing, no signed-in user. */
export const createBookingOrderSchema = z.object({
  pujaTypeId: z.string().uuid(),
  devoteeName: z.string().trim().min(2, 'Enter your name').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  phone: optionalTrimmed(20),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  note: optionalTrimmed(500),
});
export type CreateBookingOrderInput = z.infer<typeof createBookingOrderSchema>;
