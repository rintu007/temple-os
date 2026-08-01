import { emailLayout, escapeHtml } from './layout';

export interface PaymentFailedEmailParams {
  organizationName: string;
  billingUrl: string;
}

export function renderPaymentFailedEmail(params: PaymentFailedEmailParams): {
  subject: string;
  html: string;
} {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Hello,</p>
    <p style="margin:0 0 20px;">
      We couldn't process the latest subscription payment for
      <strong>${escapeHtml(params.organizationName)}</strong> on TempleOS. Your account is now
      marked past due.
    </p>
    <p style="margin:0 0 20px;">
      Your public website and donation intake keep working as normal — this only affects access
      to paid modules if the payment issue isn't resolved. Update your payment method to avoid
      any interruption.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="border-radius:8px;background-color:#ea580c;">
          <a href="${params.billingUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;">
            Update payment method
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Action needed: payment failed for ${params.organizationName}`,
    html: emailLayout({
      preheader: `We couldn't process your latest TempleOS subscription payment.`,
      bodyHtml,
    }),
  };
}
