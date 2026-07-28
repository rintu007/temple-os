import { cookies } from 'next/headers';
import type { PortalSession } from '@templeos/core';
import { donorPortalService } from './services';

export const PORTAL_COOKIE = 'templeos_portal';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 3600;

/** Reads the portal session cookie and resolves it against the DB, scoped to this org. */
export async function getPortalSession(organizationId: string): Promise<PortalSession | null> {
  const token = (await cookies()).get(PORTAL_COOKIE)?.value;
  if (!token) return null;
  return donorPortalService().getSession(organizationId, token);
}

/** Sets the session cookie. Callable only from a Server Action or Route Handler. */
export async function setPortalSessionCookie(token: string): Promise<void> {
  (await cookies()).set(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearPortalSessionCookie(): Promise<void> {
  (await cookies()).delete(PORTAL_COOKIE);
}
