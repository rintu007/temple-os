import { z } from 'zod';

/**
 * Standard note/coin denominations by currency, largest first — used by the
 * counting UI to lay out one row per denomination. INR and BDT share the same
 * face values in practice.
 */
export const DENOMINATIONS: Record<'INR' | 'BDT', number[]> = {
  INR: [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
  BDT: [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
};

export const denominationLineSchema = z.object({
  value: z.coerce.number().int().positive().max(5000),
  count: z.coerce.number().int().min(0).max(1_000_000),
});
export type DenominationLine = z.infer<typeof denominationLineSchema>;

/** Sum of value × count across counted denominations. */
export function computeHundiTotal(lines: DenominationLine[]): number {
  return lines.reduce((sum, l) => sum + l.value * l.count, 0);
}

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const recordHundiCollectionSchema = z
  .object({
    boxName: z.string().trim().min(2, 'Name the offering box').max(120),
    templeId: z
      .string()
      .uuid()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v))
      .nullish(),
    countedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v))
      .nullish(),
    /** Either a denomination tally… */
    denominations: z.array(denominationLineSchema).max(30).optional(),
    /** …or a direct total when the box wasn't counted by note. */
    amount: z.coerce.number().min(0).max(100_000_000).optional(),
    note: optionalTrimmed(500),
  })
  .refine(
    (v) => {
      const fromDenoms = v.denominations ? computeHundiTotal(v.denominations) : 0;
      const total = fromDenoms > 0 ? fromDenoms : (v.amount ?? 0);
      return total > 0;
    },
    { message: 'Enter a denomination count or a total greater than zero', path: ['amount'] },
  );
export type RecordHundiCollectionInput = z.infer<typeof recordHundiCollectionSchema>;
