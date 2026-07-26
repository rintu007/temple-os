import { z } from 'zod';

/** Indian PAN: five letters, four digits, one letter (e.g. AAATT1234C). */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const optionalPan = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => (v === '' ? null : v))
  .nullish()
  .refine((v) => v == null || PAN_REGEX.test(v), 'Enter a valid PAN (e.g. AAATT1234C)');

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();

export const taxProfileSchema = z
  .object({
    legalName: z.string().trim().min(2, 'Enter the registered legal name').max(200),
    pan: optionalPan,
    registrationNumber: z.string().trim().min(2, 'Enter the 80G registration number').max(100),
    validFrom: optionalDate,
    validUntil: optionalDate,
    showOnReceipt: z.coerce.boolean().default(true),
  })
  .refine(
    (v) => !v.validFrom || !v.validUntil || v.validFrom <= v.validUntil,
    { message: 'Valid-until cannot be before valid-from', path: ['validUntil'] },
  );
export type TaxProfileInput = z.infer<typeof taxProfileSchema>;
