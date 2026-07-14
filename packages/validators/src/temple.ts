import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const templeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  deity: optionalTrimmed(120),
  addressLine1: optionalTrimmed(200),
  addressLine2: optionalTrimmed(200),
  city: optionalTrimmed(100),
  state: optionalTrimmed(100),
  postalCode: optionalTrimmed(20),
  phone: optionalTrimmed(20),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
});
export type TempleInput = z.infer<typeof templeSchema>;

const TIME_24H = /^([01]\d|2[0-3]):[0-5]\d$/;

export const scheduleItemSchema = z
  .object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').max(120),
    startTime: z.string().regex(TIME_24H, 'Use 24h time, e.g. 06:30'),
    endTime: z
      .string()
      .regex(TIME_24H, 'Use 24h time, e.g. 07:15')
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v))
      .nullish(),
    description: optionalTrimmed(500),
  })
  .refine((v) => !v.endTime || v.endTime > v.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });
export type ScheduleItemInput = z.infer<typeof scheduleItemSchema>;
