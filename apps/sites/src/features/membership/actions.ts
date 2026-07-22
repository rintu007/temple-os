'use server';

import { renderDonationReceiptEmail, sendEmail } from '@templeos/email';
import { membershipService } from '@/lib/services';

export interface CreateJoinOrderResult {
  ok: boolean;
  error?: string;
  orderId?: string;
  amountPaise?: number;
  keyId?: string;
  planName?: string;
}

export async function createJoinOrder(
  organizationId: string,
  organizationCurrency: 'INR' | 'BDT',
  input: { planId: string; memberName: string; email: string; phone: string },
): Promise<CreateJoinOrderResult> {
  const result = await membershipService().createJoinOrder(
    organizationId,
    organizationCurrency,
    input,
  );
  if (!result.ok) return { ok: false, error: result.error.message };
  return {
    ok: true,
    orderId: result.value.orderId,
    amountPaise: result.value.amountPaise,
    keyId: result.value.keyId,
    planName: result.value.planName,
  };
}

export interface ConfirmJoinResult {
  ok: boolean;
  error?: string;
  receiptNumber?: string;
  planName?: string;
  expiresOn?: string | null;
}

export async function confirmJoin(
  organizationId: string,
  organizationName: string,
  input: { providerOrderId: string; providerPaymentId: string; signature: string; email: string },
): Promise<ConfirmJoinResult> {
  const result = await membershipService().confirmJoin(organizationId, input);
  if (!result.ok) return { ok: false, error: result.error.message };

  if (input.email) {
    const { subject, html } = renderDonationReceiptEmail({
      organizationName,
      donorName: result.value.memberName,
      amount: result.value.amount,
      currency: result.value.currency,
      receiptNumber: result.value.receiptNumber,
      donatedAt: new Date(),
      categoryName: `Membership: ${result.value.planName}`,
    });
    await sendEmail({ to: input.email, subject, html });
  }

  return {
    ok: true,
    receiptNumber: result.value.receiptNumber,
    planName: result.value.planName,
    expiresOn: result.value.expiresOn,
  };
}
