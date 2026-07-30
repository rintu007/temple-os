const GRAPH_API_VERSION = 'v21.0';

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
}

let _config: WhatsAppConfig | null | undefined;

function configFromEnv(): WhatsAppConfig | null {
  if (_config !== undefined) return _config;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  _config = accessToken && phoneNumberId ? { accessToken, phoneNumberId } : null;
  return _config;
}

export function isWhatsAppConfigured(): boolean {
  return configFromEnv() !== null;
}

export interface SendWhatsAppParams {
  /** E.164-ish: leading '+' and country code, e.g. '+919876543210'. */
  to: string;
  body: string;
}

/**
 * Best-effort send over Meta's WhatsApp Cloud API — a broadcast is a side
 * effect of an already-completed business action and must never make that
 * action fail, so this returns false (and logs) instead of throwing.
 *
 * v1 limitation: this sends a free-form text ("session") message, which Meta
 * only delivers if the recipient messaged the temple's WhatsApp number within
 * the last 24 hours. Reaching devotees outside that window requires a
 * pre-approved message template (configured in Meta Business Manager) — not
 * implemented yet. Ships the wiring and graceful degradation; template
 * support is a deliberate follow-up, not an oversight.
 */
export async function sendWhatsApp(params: SendWhatsAppParams): Promise<boolean> {
  const config = configFromEnv();
  if (!config) {
    console.warn('[whatsapp] WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID not set — skipping send to', params.to);
    return false;
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: params.to.replace(/^\+/, ''),
          type: 'text',
          text: { body: params.body },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.error('[whatsapp] send failed:', res.status, body);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[whatsapp] send failed:', e);
    return false;
  }
}
