import { NextResponse } from 'next/server';
import { setPortalSessionCookie } from '@/lib/portal-session';
import { donorPortalService, resolveSite } from '@/lib/services';

interface RouteContext {
  params: Promise<{ domain: string }>;
}

/** Magic-link landing: exchanges a one-time login token for a portal session cookie. */
export async function GET(request: Request, { params }: RouteContext) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) return NextResponse.redirect(new URL('/', request.url));

  const token = new URL(request.url).searchParams.get('token') ?? '';
  const result = await donorPortalService().verifyLogin(site.organizationId, token);

  if (!result.ok) {
    return NextResponse.redirect(new URL('/portal/login?error=expired', request.url));
  }

  await setPortalSessionCookie(result.value.sessionToken);
  return NextResponse.redirect(new URL('/portal', request.url));
}
