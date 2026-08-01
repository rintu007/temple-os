import type { MetadataRoute } from 'next';

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';

/** Marketing root domain only — each tenant site has its own sitemap ([domain]/robots.ts territory). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${rootDomain}`;
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/pricing`, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
