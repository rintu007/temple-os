import { emailLayout, escapeHtml } from './layout';

export interface BroadcastEmailParams {
  organizationName: string;
  subject: string;
  message: string;
  recipientName?: string | null;
}

/**
 * Renders a plain-text message (as typed by staff) into the shared email
 * shell. Blank lines become paragraph breaks; everything is escaped so the
 * message can never inject markup. Used for devotee broadcasts.
 */
export function renderBroadcastEmail(params: BroadcastEmailParams): {
  subject: string;
  html: string;
} {
  const paragraphs = params.message
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;">${escapeHtml(block).replace(/\n/g, '<br />')}</p>`,
    )
    .join('');

  const greeting = params.recipientName
    ? `<p style="margin:0 0 16px;font-size:15px;color:#18181b;">Dear ${escapeHtml(params.recipientName)},</p>`
    : '';

  const bodyHtml = `
    ${greeting}
    ${paragraphs}
    <p style="margin:24px 0 0;color:#71717a;font-size:13px;">
      — ${escapeHtml(params.organizationName)}
    </p>`;

  return { subject: params.subject, html: emailLayout({ preheader: params.subject, bodyHtml }) };
}
