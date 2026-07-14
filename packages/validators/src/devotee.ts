import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const devoteeSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  phone: optionalTrimmed(20),
  gender: z
    .enum(['male', 'female', 'other'])
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  addressLine1: optionalTrimmed(200),
  city: optionalTrimmed(100),
  state: optionalTrimmed(100),
  postalCode: optionalTrimmed(20),
  notes: optionalTrimmed(1000),
  /** Optional household name; the service finds or creates the family. */
  familyName: optionalTrimmed(120),
});
export type DevoteeInput = z.infer<typeof devoteeSchema>;

export const devoteeListQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type DevoteeListQuery = z.infer<typeof devoteeListQuerySchema>;
