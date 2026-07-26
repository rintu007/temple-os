import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const fundSchema = z.object({
  name: z.string().trim().min(2, 'Enter a fund name').max(80),
  description: optionalTrimmed(300),
});
export type FundInput = z.infer<typeof fundSchema>;

export const fundListQuerySchema = z.object({
  scope: z.enum(['active', 'all']).default('active'),
});
export type FundListQuery = z.infer<typeof fundListQuerySchema>;
