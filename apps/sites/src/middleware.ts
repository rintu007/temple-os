import { NextResponse, type NextRequest } from 'next/server';

/**
 * Host → tenant resolution.
 *
 *   demo.templeos.com      → rewrite to /demo/...
 *   demo.localhost         → rewrite to /demo/...        (local dev)
 *   templeos.com, www.     → pass through (root landing page)
 *   mykalibari.org         → rewrite to /mykalibari.org/... (custom domain, Phase 3;
 *                            resolved against the domains table in the app layer)
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0] ?? '';
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost').toLowerCase();

  if (host === rootDomain || host === `www.${rootDomain}`) {
    return NextResponse.next();
  }

  const tenant = host.endsWith(`.${rootDomain}`)
    ? host.slice(0, -(rootDomain.length + 1)) // subdomain slug
    : host; // custom domain: full hostname is the lookup key

  if (!tenant) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL(`/${tenant}${url.pathname}${url.search}`, request.url));
}

export const config = {
  // Skip static assets and Next internals
  matcher: ['/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)'],
};
