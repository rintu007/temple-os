import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalTime = z
  .string()
  .regex(TIME_RE, 'Use 24h time, e.g. 18:30')
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();

export const eventSchema = z
  .object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').max(160),
    kind: z.enum(['event', 'festival']).default('event'),
    description: optionalTrimmed(2000),
    location: optionalTrimmed(200),
    date: z.string().regex(DATE_RE, 'Pick a date'),
    startTime: optionalTime,
    endDate: z
      .string()
      .regex(DATE_RE, 'Use YYYY-MM-DD')
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v))
      .nullish(),
    endTime: optionalTime,
    isPublished: z.boolean().default(true),
  })
  .refine((v) => !v.endDate || v.endDate >= v.date, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })
  .refine(
    (v) => {
      if (v.endTime && !v.endDate) {
        return !v.startTime || v.endTime > v.startTime;
      }
      return true;
    },
    { message: 'End time must be after start time', path: ['endTime'] },
  );
export type EventInput = z.infer<typeof eventSchema>;

export const eventListQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type EventListQuery = z.infer<typeof eventListQuerySchema>;
