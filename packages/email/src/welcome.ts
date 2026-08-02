import { emailLayout, escapeHtml } from './layout';

export interface WelcomeEmailParams {
  organizationName: string;
  recipientName?: string | null;
  dashboardUrl: string;
  devoteesUrl: string;
  teamUrl: string;
  websiteUrl: string;
}

export function renderWelcomeEmail(params: WelcomeEmailParams): { subject: string; html: string } {
  const greeting = params.recipientName ? `Hello ${escapeHtml(params.recipientName)},` : 'Hello,';
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#18181b;">${greeting}</p>
    <p style="margin:0 0 20px;">
      <strong>${escapeHtml(params.organizationName)}</strong> is live on TempleOS. Here's how most
      temples get started:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;">
      <tr>
        <td style="padding:0 0 14px;">
          <a href="${params.devoteesUrl}" style="color:#ea580c;font-weight:600;text-decoration:none;">Add your first devotee</a>
          <div style="color:#71717a;font-size:13px;">Start your devotee directory — or import a list all at once.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 0 14px;">
          <a href="${params.teamUrl}" style="color:#ea580c;font-weight:600;text-decoration:none;">Invite your team</a>
          <div style="color:#71717a;font-size:13px;">Bring in staff and volunteers with the right role for each person.</div>
        </td>
      </tr>
      <tr>
        <td>
          <a href="${params.websiteUrl}" style="color:#ea580c;font-weight:600;text-decoration:none;">Customize your public website</a>
          <div style="color:#71717a;font-size:13px;">Add your temple's story, events, and a way for devotees to donate online.</div>
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
      <tr>
        <td style="border-radius:8px;background-color:#ea580c;">
          <a href="${params.dashboardUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;">
            Go to your dashboard
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Welcome to TempleOS, ${params.organizationName}`,
    html: emailLayout({
      preheader: `${params.organizationName} is live — here's how to get started.`,
      bodyHtml,
    }),
  };
}
