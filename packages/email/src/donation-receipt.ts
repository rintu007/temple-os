import { emailLayout, escapeHtml } from './layout';

export interface DonationReceiptParams {
  organizationName: string;
  donorName: string;
  amount: string;
  currency: 'INR' | 'BDT';
  receiptNumber: string;
  donatedAt: Date;
  categoryName?: string | null;
}

const CURRENCY_SYMBOL: Record<string, string> = { INR: '₹', BDT: '৳' };

export function renderDonationReceiptEmail(params: DonationReceiptParams): {
  subject: string;
  html: string;
} {
  const symbol = CURRENCY_SYMBOL[params.currency] ?? '';
  const amountDisplay = `${symbol}${Number(params.amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const dateDisplay = params.donatedAt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Dear ${escapeHtml(params.donorName)},</p>
    <p style="margin:0 0 20px;">
      Thank you for your generous donation to <strong>${escapeHtml(params.organizationName)}</strong>.
      Your contribution helps sustain our seva and daily worship.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:8px;margin-bottom:20px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
            <tr><td style="padding:4px 0;color:#71717a;">Receipt No.</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#18181b;">${escapeHtml(params.receiptNumber)}</td></tr>
            <tr><td style="padding:4px 0;color:#71717a;">Amount</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#18181b;">${amountDisplay}</td></tr>
            ${params.categoryName ? `<tr><td style="padding:4px 0;color:#71717a;">Category</td><td style="padding:4px 0;text-align:right;color:#18181b;">${escapeHtml(params.categoryName)}</td></tr>` : ''}
            <tr><td style="padding:4px 0;color:#71717a;">Date</td><td style="padding:4px 0;text-align:right;color:#18181b;">${escapeHtml(dateDisplay)}</td></tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#71717a;font-size:13px;">
      Please retain this email as your donation receipt.
    </p>
  `;

  return {
    subject: `Your donation receipt — ${params.receiptNumber}`,
    html: emailLayout({
      preheader: `Receipt ${params.receiptNumber} for your donation to ${params.organizationName}`,
      bodyHtml,
    }),
  };
}
