import type { MetadataRoute } from 'next';

/** The marketing root domain is a placeholder page until Phase 2 — nothing to index yet. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
