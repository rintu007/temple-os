import { z } from 'zod';

export const uuidSchema = z.string().uuid();

/** Lowercase DNS-label slug: what we allow as a `{slug}.templeos.com` subdomain. */
export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(63, 'Slug must be at most 63 characters')
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    'Slug may contain lowercase letters, numbers and hyphens, and must start/end with a letter or number',
  );

/** Subdomains we never hand out to tenants. */
export const RESERVED_SLUGS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'mail',
  'ftp',
  'blog',
  'docs',
  'status',
  'help',
  'support',
  'billing',
  'assets',
  'cdn',
  'static',
  'staging',
  'dev',
  'test',
]);

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
