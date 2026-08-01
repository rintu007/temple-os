import type { MetadataRoute } from 'next';

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';

/** The marketing root domain (this app's `/` and `/pricing`) is public and indexable. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `https://${rootDomain}/sitemap.xml`,
  };
}
