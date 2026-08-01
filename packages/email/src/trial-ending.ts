import { emailLayout, escapeHtml } from './layout';

export interface TrialEndingEmailParams {
  organizationName: string;
  trialEndsAt: Date;
  billingUrl: string;
}

export function renderTrialEndingEmail(params: TrialEndingEmailParams): {
  subject: string;
  html: string;
} {
  const endsDate = params.trialEndsAt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Hello,</p>
    <p style="margin:0 0 20px;">
      <strong>${escapeHtml(params.organizationName)}</strong>&apos;s TempleOS trial ends on
      <strong>${endsDate}</strong>. After that, your account moves to the free Starter plan —
      your public website, devotees, one-time donations, and events keep working, but worship
      bookings, community tools, and fundraising features will no longer be available until you
      upgrade.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="border-radius:8px;background-color:#ea580c;">
          <a href="${params.billingUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;">
            Choose a plan
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `${params.organizationName}'s TempleOS trial ends ${endsDate}`,
    html: emailLayout({
      preheader: `Your TempleOS trial ends ${endsDate} — choose a plan to keep every feature.`,
      bodyHtml,
    }),
  };
}
