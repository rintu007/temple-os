import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

/** 'Diwali Celebrations 2026!' → 'diwali-celebrations-2026'. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export const postSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  /** Left blank to derive from the title. */
  slug: z
    .string()
    .trim()
    .max(100)
    .transform((v) => (v === '' ? null : slugify(v)))
    .nullish(),
  excerpt: optionalTrimmed(300),
  body: z.string().trim().min(10, 'Write at least a few sentences').max(20_000),
  coverImageUrl: z
    .string()
    .trim()
    .url('Enter a valid URL')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  authorName: optionalTrimmed(120),
});
export type PostInput = z.infer<typeof postSchema>;
