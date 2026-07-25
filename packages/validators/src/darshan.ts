import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

const timeString = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');

export const darshanSlotSchema = z.object({
  name: z.string().trim().min(2, 'Name the darshan slot').max(120),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  startTime: timeString,
  endTime: timeString.or(z.literal('')).transform((v) => (v === '' ? null : v)).nullish(),
  capacity: z.coerce
    .number()
    .int('Capacity must be a whole number')
    .min(1, 'Capacity must be at least 1')
    .max(1_000_000, 'Capacity is too large'),
  note: optionalTrimmed(500),
});
export type DarshanSlotInput = z.infer<typeof darshanSlotSchema>;

/** Public token booking — devotee-facing, no signed-in user. */
export const bookDarshanTokenSchema = z.object({
  slotId: z.string().uuid(),
  devoteeName: z.string().trim().min(2, 'Enter your name').max(120),
  phone: z.string().trim().min(4, 'Enter a phone number').max(20),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  partySize: z.coerce
    .number()
    .int('Party size must be a whole number')
    .min(1, 'At least one person')
    .max(100, 'Party size is too large')
    .default(1),
  note: optionalTrimmed(300),
});
export type BookDarshanTokenInput = z.infer<typeof bookDarshanTokenSchema>;
