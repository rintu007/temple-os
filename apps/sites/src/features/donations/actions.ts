'use server';

import { renderDonationReceiptEmail, sendEmail } from '@templeos/email';
import { paymentService } from '@/lib/services';

export interface CreateOrderResult {
  ok: boolean;
  error?: string;
  orderId?: string;
  amountPaise?: number;
  keyId?: string;
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
  });
  if (!result.ok) return { ok: false, error: result.error.message };
  return {
    ok: true,
    orderId: result.value.orderId,
    amountPaise: result.value.amountPaise,
    keyId: result.value.keyId,
  };
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

  if (input.email) {
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
