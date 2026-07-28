/**
 * Next.js metadata-route conventions (robots.ts, sitemap.ts) don't support a
 * dynamic parent segment like [domain] — they only resolve at a fixed path,
 * so a literal `robots.txt` route handler is used here instead.
 *
 * Every tenant page currently sets `robots: { index: false }` (see the
 * homepage's generateMetadata) — sites stay out of search until an explicit
 * "publish this site" step ships. This mirrors that policy explicitly rather
 * than leaving crawlers to fall back on a missing/404 robots.txt.
 */
export function GET(): Response {
  return new Response('User-agent: *\nDisallow: /\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
