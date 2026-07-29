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

/** Priest / pujari roster entry. */
export const priestSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  phone: optionalTrimmed(20),
  specialty: optionalTrimmed(160),
  isActive: z.boolean().default(true),
});
export type PriestInput = z.infer<typeof priestSchema>;

/** Assigning a priest + slot to a confirmed booking. Empty strings clear the field. */
export const assignSevaSchema = z.object({
  priestId: z
    .string()
    .uuid()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  scheduledOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Use HH:MM')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
});
export type AssignSevaInput = z.infer<typeof assignSevaSchema>;

/** A priest's standing duty on the daily-schedule roster (separate from one-off booking assignment). */
export const priestDutyAssignmentSchema = z.object({
  priestId: z.string().uuid('Choose a priest'),
  dailyScheduleId: z.string().uuid('Choose a ritual'),
  /** 0=Sunday..6=Saturday; empty = every day. */
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  notes: optionalTrimmed(300),
});
export type PriestDutyAssignmentInput = z.infer<typeof priestDutyAssignmentSchema>;

export const priestLeaveSchema = z
  .object({
    priestId: z.string().uuid('Choose a priest'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    reason: optionalTrimmed(300),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });
export type PriestLeaveInput = z.infer<typeof priestLeaveSchema>;
