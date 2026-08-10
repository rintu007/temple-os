import { emailLayout, escapeHtml } from './layout';

export interface OnboardingNudgeEmailParams {
  day: 1 | 3 | 7;
  organizationName: string;
  recipientName?: string | null;
  dashboardUrl: string;
  devoteesUrl: string;
  teamUrl: string;
  websiteUrl: string;
  pujasUrl: string;
  donationsUrl: string;
}

const CTA_BUTTON = (href: string, label: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
    <tr>
      <td style="border-radius:8px;background-color:#ea580c;">
        <a href="${href}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;">
          ${label}
        </a>
      </td>
    </tr>
  </table>
`;

export function renderOnboardingNudgeEmail(params: OnboardingNudgeEmailParams): {
  subject: string;
  html: string;
} {
  const greeting = params.recipientName ? `Hello ${escapeHtml(params.recipientName)},` : 'Hello,';
  const org = escapeHtml(params.organizationName);

  let subject: string;
  let bodyHtml: string;

  if (params.day === 1) {
    subject = `Getting started with ${params.organizationName}`;
    bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;color:#18181b;">${greeting}</p>
      <p style="margin:0 0 20px;">
        <strong>${org}</strong> joined TempleOS yesterday — just checking in. Two quick things that
        make the biggest difference early on:
      </p>
      <ul style="margin:0 0 20px;padding-left:20px;color:#3f3f46;">
        <li style="margin-bottom:8px;"><a href="${params.devoteesUrl}" style="color:#ea580c;font-weight:600;text-decoration:none;">Add your first devotee</a> — or import a list all at once.</li>
        <li><a href="${params.websiteUrl}" style="color:#ea580c;font-weight:600;text-decoration:none;">Customize your public website</a> — it's free forever, even after your trial.</li>
      </ul>
      ${CTA_BUTTON(params.dashboardUrl, 'Go to your dashboard')}
    `;
  } else if (params.day === 3) {
    subject = `Bring your team into ${params.organizationName}`;
    bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;color:#18181b;">${greeting}</p>
      <p style="margin:0 0 20px;">
        Most temples run TempleOS with more than one person. Invite your priests, office staff, or
        volunteers now — each person gets a role suited to what they need to see and do, and seats
        are included on your trial.
      </p>
      ${CTA_BUTTON(params.teamUrl, 'Invite your team')}
    `;
  } else {
    subject = `One week in — here's what ${params.organizationName} can do`;
    bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;color:#18181b;">${greeting}</p>
      <p style="margin:0 0 20px;">
        You're a week into your trial. Beyond your devotee list and public website, your trial also
        includes:
      </p>
      <ul style="margin:0 0 20px;padding-left:20px;color:#3f3f46;">
        <li style="margin-bottom:8px;"><a href="${params.pujasUrl}" style="color:#ea580c;font-weight:600;text-decoration:none;">Puja and worship bookings</a> — let devotees book directly from your site.</li>
        <li><a href="${params.donationsUrl}" style="color:#ea580c;font-weight:600;text-decoration:none;">Online donations</a> — accept and track them with full fund accounting.</li>
      </ul>
      <p style="margin:0;color:#71717a;font-size:13px;">
        Your public website and donation intake keep working regardless of your plan — worship
        bookings, community tools, and fundraising are what a paid plan adds once your trial ends.
      </p>
      ${CTA_BUTTON(params.dashboardUrl, 'Go to your dashboard')}
    `;
  }

  return {
    subject,
    html: emailLayout({ preheader: subject, bodyHtml }),
  };
}
