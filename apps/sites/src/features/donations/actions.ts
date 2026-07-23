'use server';

import { headers } from 'next/headers';
import { renderDonationReceiptEmail, sendEmail } from '@templeos/email';
import { paymentService } from '@/lib/services';

export interface CreateOrderResult {
  ok: boolean;
  error?: string;
  /** Razorpay: open the in-page modal with these. */
  orderId?: string;
  amountPaise?: number;
  keyId?: string;
  /** SSLCommerz: redirect the browser here. */
  redirectUrl?: string;
}

/** The tenant site's public origin — redirect providers return here. */
async function callbackBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** organizationId/organizationName/currency are bound server-side from the resolved tenant page. */
export async function createDonationOrder(
  organizationId: string,
  organizationCurrency: 'INR' | 'BDT',
  input: {
    amount: string;
    donorName: string;
    email: string;
    phone: string;
    categoryName: string;
  },
): Promise<CreateOrderResult> {
  const result = await paymentService().createDonationOrder({
    organizationId,
    organizationCurrency,
    rawInput: input,
    callbackBaseUrl: await callbackBaseUrl(),
  });
  if (!result.ok) return { ok: false, error: result.error.message };

  if (result.value.kind === 'razorpay') {
    return {
      ok: true,
      orderId: result.value.orderId,
      amountPaise: result.value.amountPaise,
      keyId: result.value.keyId,
    };
  }
  return { ok: true, redirectUrl: result.value.gatewayUrl };
}

export interface ConfirmOrderResult {
  ok: boolean;
  error?: string;
  receiptNumber?: string;
}

export async function confirmDonationOrder(
  organizationId: string,
  organizationName: string,
  input: { providerOrderId: string; providerPaymentId: string; signature: string; email: string },
): Promise<ConfirmOrderResult> {
  const result = await paymentService().confirmDonationOrder(organizationId, input);
  if (!result.ok) return { ok: false, error: result.error.message };

  // Skip the email when the webhook already recorded (and emailed) this payment.
  if (input.email && !result.value.alreadyPaid) {
    const { subject, html } = renderDonationReceiptEmail({
      organizationName,
      donorName: result.value.donorName,
      amount: result.value.amount,
      currency: result.value.currency,
      receiptNumber: result.value.receiptNumber,
      donatedAt: new Date(),
    });
    // Best-effort: the donation is already recorded regardless of email outcome.
    await sendEmail({ to: input.email, subject, html });
  }

  return { ok: true, receiptNumber: result.value.receiptNumber };
}
