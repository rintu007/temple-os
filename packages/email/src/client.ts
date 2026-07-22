import { Resend } from 'resend';

/**
 * Sandbox sender that works without a verified domain — fine for
 * development. Set RESEND_FROM_EMAIL once a domain is verified in
 * production (e.g. "TempleOS <receipts@templeos.com>").
 */
const DEFAULT_FROM = 'TempleOS <onboarding@resend.dev>';

let _client: Resend | null | undefined;

function resendClient(): Resend | null {
  if (_client !== undefined) return _client;
  const apiKey = process.env.RESEND_API_KEY;
  _client = apiKey ? new Resend(apiKey) : null;
  return _client;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Best-effort send: email is a side effect of an already-completed business
 * action (a donation is recorded, an invitation exists) and must never make
 * that action fail. Returns false (and logs) instead of throwing.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const client = resendClient();
  if (!client) {
    console.warn('[email] RESEND_API_KEY not set — skipping send to', params.to);
    return false;
  }
  try {
    const { error } = await client.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      console.error('[email] Resend rejected the message:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[email] send failed:', e);
    return false;
  }
}
