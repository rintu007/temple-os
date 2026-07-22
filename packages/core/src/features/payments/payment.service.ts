import type { Db } from '@templeos/db';
import { confirmDonationOrderSchema, createDonationOrderSchema } from '@templeos/validators';
import { domainError, err, notFound, ok, type Result } from '../../shared';
import { createPaymentOrderRepository } from './order.repository';
import { razorpayFromEnv } from './razorpay';
import type { ConfirmedDonation, DonationOrder } from './order.types';

export interface CreateDonationOrderParams {
  organizationId: string;
  organizationCurrency: 'INR' | 'BDT';
  rawInput: unknown;
}

/**
 * Public-facing payment flow — invoked from the anonymous tenant website, so
 * there is no TenantContext (no signed-in user). Scoping is by organizationId
 * only, same as the other public listings (resolveSiteByHostname, etc).
 */
export function createPaymentService({ db }: { db: Db }) {
  const repo = createPaymentOrderRepository(db);

  return {
    /** Only INR (Razorpay) is wired up today; BDT (SSLCommerz) is Phase 1 backlog. */
    isOnlineCheckoutAvailable(currency: 'INR' | 'BDT'): boolean {
      return currency === 'INR' && razorpayFromEnv() !== null;
    },

    async createDonationOrder(params: CreateDonationOrderParams): Promise<Result<DonationOrder>> {
      const razorpay = razorpayFromEnv();
      if (!razorpay) {
        return err(domainError('VALIDATION', 'Online donations are not configured'));
      }
      if (params.organizationCurrency !== 'INR') {
        return err(
          domainError('VALIDATION', 'Online donations are not yet available for this currency'),
        );
      }
      const parsed = createDonationOrderSchema.safeParse(params.rawInput);
      if (!parsed.success) {
        return err(domainError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid input'));
      }
      const input = parsed.data;
      const amountPaise = Math.round(input.amount * 100);

      const order = await razorpay.createOrder({
        amountPaise,
        currency: 'INR',
        notes: { organizationId: params.organizationId },
      });

      await repo.createOrder(params.organizationId, {
        providerOrderId: order.id,
        amount: input.amount.toFixed(2),
        currency: 'INR',
        donorName: input.donorName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        categoryName: input.categoryName ?? null,
      });

      return ok({ orderId: order.id, amountPaise, currency: 'INR', keyId: razorpay.keyId });
    },

    async confirmDonationOrder(
      organizationId: string,
      rawInput: unknown,
    ): Promise<Result<ConfirmedDonation>> {
      const razorpay = razorpayFromEnv();
      if (!razorpay) {
        return err(domainError('VALIDATION', 'Online donations are not configured'));
      }
      const parsed = confirmDonationOrderSchema.safeParse(rawInput);
      if (!parsed.success) {
        return err(domainError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid input'));
      }
      const { providerOrderId, providerPaymentId, signature } = parsed.data;

      const validSignature = razorpay.verifyPaymentSignature({
        orderId: providerOrderId,
        paymentId: providerPaymentId,
        signature,
      });
      if (!validSignature) {
        return err(domainError('FORBIDDEN', 'Payment could not be verified'));
      }

      const result = await repo.confirmPaid(organizationId, providerOrderId, providerPaymentId);
      if (result.kind === 'order_not_found') return err(notFound('Donation order'));

      const d = result.donation;
      return ok({
        receiptNumber: d.receiptNumber,
        amount: d.amount,
        currency: d.currency,
        donorName: d.donorName,
        alreadyPaid: result.alreadyPaid,
      });
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
