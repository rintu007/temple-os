import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();

/** Common designations offered in the form's datalist. */
export const OFFICER_DESIGNATIONS = [
  'President',
  'Vice President',
  'Secretary',
  'Joint Secretary',
  'Treasurer',
  'Managing Trustee',
  'Trustee',
  'Committee Member',
] as const;

export const officeBearerSchema = z.object({
  name: z.string().trim().min(2, 'Enter the name').max(120),
  designation: z.string().trim().min(2, 'Enter a designation').max(80),
  body: optionalTrimmed(120),
  phone: optionalTrimmed(20),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  termStartsOn: optionalDate,
  termEndsOn: optionalDate,
  note: optionalTrimmed(500),
});
export type OfficeBearerInput = z.infer<typeof officeBearerSchema>;
