'use server';

import { renderDonationReceiptEmail, sendEmail } from '@templeos/email';
import { pujaService } from '@/lib/services';

export interface CreateBookingOrderResult {
  ok: boolean;
  error?: string;
  orderId?: string;
  amountPaise?: number;
  keyId?: string;
  pujaName?: string;
}

export async function createBookingOrder(
  organizationId: string,
  organizationCurrency: 'INR' | 'BDT',
  input: {
    pujaTypeId: string;
    devoteeName: string;
    email: string;
    phone: string;
    preferredDate: string;
    note: string;
  },
): Promise<CreateBookingOrderResult> {
  const result = await pujaService().createBookingOrder(organizationId, organizationCurrency, input);
  if (!result.ok) return { ok: false, error: result.error.message };
  return {
    ok: true,
    orderId: result.value.orderId,
    amountPaise: result.value.amountPaise,
    keyId: result.value.keyId,
    pujaName: result.value.pujaName,
  };
}

export interface ConfirmBookingResult {
  ok: boolean;
  error?: string;
  receiptNumber?: string;
  pujaName?: string;
}

export async function confirmBooking(
  organizationId: string,
  organizationName: string,
  input: { providerOrderId: string; providerPaymentId: string; signature: string; email: string },
): Promise<ConfirmBookingResult> {
  const result = await pujaService().confirmBooking(organizationId, input);
  if (!result.ok) return { ok: false, error: result.error.message };

  if (input.email) {
    const { subject, html } = renderDonationReceiptEmail({
      organizationName,
      donorName: result.value.devoteeName,
      amount: result.value.amount,
      currency: result.value.currency,
      receiptNumber: result.value.receiptNumber,
      donatedAt: new Date(),
      categoryName: `Puja: ${result.value.pujaName}`,
    });
    await sendEmail({ to: input.email, subject, html });
  }

  return { ok: true, receiptNumber: result.value.receiptNumber, pujaName: result.value.pujaName };
}
