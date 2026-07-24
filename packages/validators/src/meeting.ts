import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => (v.trim() === '' ? null : v))
    .nullish();

export const MEETING_STATUSES = ['scheduled', 'held', 'cancelled'] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled',
  held: 'Held',
  cancelled: 'Cancelled',
};

export const meetingSchema = z.object({
  title: z.string().trim().min(2, 'Give the meeting a title').max(200),
  body: optionalTrimmed(160),
  meetingOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  location: optionalTrimmed(160),
  attendees: optionalText(4000),
  agenda: optionalText(8000),
  minutes: optionalText(20000),
  decisions: optionalText(8000),
  status: z.enum(MEETING_STATUSES).default('scheduled'),
});
export type MeetingInput = z.infer<typeof meetingSchema>;
