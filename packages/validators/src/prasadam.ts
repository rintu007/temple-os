import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const PRASADAM_MEALS = ['breakfast', 'lunch', 'dinner', 'prasadam'] as const;
export type PrasadamMeal = (typeof PRASADAM_MEALS)[number];

export const MEAL_LABELS: Record<PrasadamMeal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch (Annadanam)',
  dinner: 'Dinner',
  prasadam: 'Prasadam',
};

/**
 * A serving log entry. `sponsorAmount`, when greater than zero, records a
 * sponsorship donation into the ledger and links it to the session.
 */
export const recordPrasadamSchema = z.object({
  meal: z.enum(PRASADAM_MEALS),
  servedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  servedCount: z.coerce
    .number()
    .int('Count must be a whole number')
    .min(1, 'Enter how many were served')
    .max(1_000_000, 'Count is too large'),
  sponsorName: optionalTrimmed(160),
  sponsorAmount: z.coerce
    .number()
    .min(0)
    .max(100_000_000, 'Amount is too large')
    .optional(),
  note: optionalTrimmed(500),
});
export type RecordPrasadamInput = z.infer<typeof recordPrasadamSchema>;
