import { emailLayout, escapeHtml } from './layout';

export interface InvitationEmailParams {
  organizationName: string;
  roleName: string;
  inviteUrl: string;
  invitedByName?: string | null;
}

export function renderInvitationEmail(params: InvitationEmailParams): {
  subject: string;
  html: string;
} {
  const inviter = params.invitedByName ? `${escapeHtml(params.invitedByName)} has` : 'You have been';
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Hello,</p>
    <p style="margin:0 0 20px;">
      ${inviter} invited you to join <strong>${escapeHtml(params.organizationName)}</strong> on
      TempleOS as <strong>${escapeHtml(params.roleName)}</strong>.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="border-radius:8px;background-color:#ea580c;">
          <a href="${params.inviteUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;">
            Accept invitation
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#71717a;font-size:13px;">
      This link expires in 7 days. If the button doesn't work, copy this link:<br />
      <span style="word-break:break-all;">${escapeHtml(params.inviteUrl)}</span>
    </p>
  `;

  return {
    subject: `You're invited to join ${params.organizationName} on TempleOS`,
    html: emailLayout({
      preheader: `Join ${params.organizationName} on TempleOS as ${params.roleName}`,
      bodyHtml,
    }),
  };
}
