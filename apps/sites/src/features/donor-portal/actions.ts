'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { renderDevoteeLoginEmail, sendEmail } from '@templeos/email';
import { clearPortalSessionCookie } from '@/lib/portal-session';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { donorPortalService } from '@/lib/services';

export interface PortalLoginFormState {
  error?: string;
  message?: string;
}

/** The tenant site's public origin — the magic link redirects back here. */
async function siteBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function requestPortalLoginAction(
  organizationId: string,
  organizationName: string,
  _prev: PortalLoginFormState,
  formData: FormData,
): Promise<PortalLoginFormState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Enter your email address' };

  // Two independent budgets: per-IP guards against one attacker hammering the
  // endpoint; per-email guards against a specific devotee's inbox being
  // bombed with login links from many different IPs.
  const ipRate = await checkRateLimit('portal:login-ip', await clientIp(), 20, 3_600);
  const emailRate = await checkRateLimit('portal:login-email', email.toLowerCase(), 5, 3_600);
  if (!ipRate.allowed || !emailRate.allowed) {
    return { error: 'Too many requests. Please try again later.' };
  }

  const result = await donorPortalService().requestLogin(organizationId, email);
  if (!result.ok) return { error: result.error.message };

  // Never reveal whether the email matched a devotee record.
  if (result.value) {
    const baseUrl = await siteBaseUrl();
    const loginUrl = `${baseUrl}/portal/verify?token=${encodeURIComponent(result.value.token)}`;
    const { subject, html } = renderDevoteeLoginEmail({
      organizationName,
      devoteeName: result.value.devoteeName,
      loginUrl,
    });
    await sendEmail({ to: email, subject, html });
  }

  return {
    message: "If that email is on file, we've sent a sign-in link. It expires in 15 minutes.",
  };
}

export async function portalLogoutAction(organizationId: string, sessionToken: string): Promise<void> {
  await donorPortalService().logout(organizationId, sessionToken);
  await clearPortalSessionCookie();
  redirect('/portal/login');
}
