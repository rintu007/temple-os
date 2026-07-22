import { emailLayout, escapeHtml } from './layout';

export interface ContactMessageEmailParams {
  organizationName: string;
  senderName: string;
  senderEmail?: string | null;
  senderPhone?: string | null;
  message: string;
}

export function renderContactMessageEmail(params: ContactMessageEmailParams): {
  subject: string;
  html: string;
} {
  const reply = [
    params.senderEmail ? `Email: ${escapeHtml(params.senderEmail)}` : null,
    params.senderPhone ? `Phone: ${escapeHtml(params.senderPhone)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#18181b;">
      New message from your website contact form:
    </p>
    <div style="margin:0 0 20px;padding:16px;border-left:3px solid #ea580c;background-color:#fafafa;">
      <p style="margin:0 0 8px;font-weight:600;">${escapeHtml(params.senderName)}</p>
      ${reply ? `<p style="margin:0 0 12px;font-size:13px;color:#71717a;">${reply}</p>` : ''}
      <p style="margin:0;white-space:pre-line;">${escapeHtml(params.message)}</p>
    </div>
    <p style="margin:0;color:#71717a;font-size:13px;">
      You can also see all messages in your TempleOS admin under Website → Messages.
    </p>
  `;

  return {
    subject: `New contact message for ${params.organizationName} — ${params.senderName}`,
    html: emailLayout({
      preheader: `${params.senderName} sent a message via your website`,
      bodyHtml,
    }),
  };
}
