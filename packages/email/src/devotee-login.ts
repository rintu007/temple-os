import { emailLayout, escapeHtml } from './layout';

export interface DevoteeLoginEmailParams {
  organizationName: string;
  devoteeName: string;
  loginUrl: string;
}

export function renderDevoteeLoginEmail(params: DevoteeLoginEmailParams): {
  subject: string;
  html: string;
} {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Hello ${escapeHtml(params.devoteeName)},</p>
    <p style="margin:0 0 20px;">
      Use the button below to sign in to your donor portal at
      <strong>${escapeHtml(params.organizationName)}</strong> and view your donation history and receipts.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="border-radius:8px;background-color:#ea580c;">
          <a href="${params.loginUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;">
            Sign in
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#71717a;font-size:13px;">
      This link expires in 15 minutes and can only be used once. If you didn't request it, you can
      safely ignore this email. If the button doesn't work, copy this link:<br />
      <span style="word-break:break-all;">${escapeHtml(params.loginUrl)}</span>
    </p>
  `;

  return {
    subject: `Sign in to your ${params.organizationName} donor portal`,
    html: emailLayout({
      preheader: `Sign in to view your donations at ${params.organizationName}`,
      bodyHtml,
    }),
  };
}
