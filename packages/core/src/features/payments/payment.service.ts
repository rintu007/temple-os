import { newId, type Db } from '@templeos/db';
import {
  confirmDonationOrderSchema,
  confirmSslcommerzSchema,
  createDonationOrderSchema,
} from '@templeos/validators';
import { domainError, err, notFound, ok, type Result } from '../../shared';
import { createPaymentOrderRepository } from './order.repository';
import { razorpayFromEnv } from './razorpay';
import { sslcommerzFromEnv } from './sslcommerz';
import type { ConfirmedDonation, DonationOrder } from './order.types';

export interface CreateDonationOrderParams {
  organizationId: string;
  organizationCurrency: 'INR' | 'BDT';
  rawInput: unknown;
  /** Absolute origin of the tenant site (e.g. https://demo.templeos.com) —
   *  required for redirect providers (SSLCommerz) to build return URLs. */
  callbackBaseUrl?: string;
}

/**
 * Public-facing payment flow — invoked from the anonymous tenant website, so
 * there is no TenantContext (no signed-in user). Scoping is by organizationId
 * only, same as the other public listings (resolveSiteByHostname, etc).
 */
export function createPaymentService({ db }: { db: Db }) {
  const repo = createPaymentOrderRepository(db);

  return {
    /** INR → Razorpay; BDT → SSLCommerz. Each activates when its env keys exist. */
    isOnlineCheckoutAvailable(currency: 'INR' | 'BDT'): boolean {
      if (currency === 'INR') return razorpayFromEnv() !== null;
      return sslcommerzFromEnv() !== null;
    },

    async createDonationOrder(params: CreateDonationOrderParams): Promise<Result<DonationOrder>> {
      const parsed = createDonationOrderSchema.safeParse(params.rawInput);
      if (!parsed.success) {
        return err(domainError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid input'));
      }
      const input = parsed.data;

      if (params.organizationCurrency === 'INR') {
        const razorpay = razorpayFromEnv();
        if (!razorpay) {
          return err(domainError('VALIDATION', 'Online donations are not configured'));
        }
        const amountPaise = Math.round(input.amount * 100);

        const order = await razorpay.createOrder({
          amountPaise,
          currency: 'INR',
          notes: { organizationId: params.organizationId },
        });

        await repo.createOrder(params.organizationId, {
          providerOrderId: order.id,
          provider: 'razorpay',
          amount: input.amount.toFixed(2),
          currency: 'INR',
          donorName: input.donorName,
          email: input.email ?? null,
          phone: input.phone ?? null,
          categoryName: input.categoryName ?? null,
        });

        return ok({
          kind: 'razorpay',
          orderId: order.id,
          amountPaise,
          currency: 'INR',
          keyId: razorpay.keyId,
        });
      }

      // BDT — SSLCommerz hosted checkout (redirect flow)
      const sslcommerz = sslcommerzFromEnv();
      if (!sslcommerz) {
        return err(
          domainError('VALIDATION', 'Online donations are not yet available for this currency'),
        );
      }
      if (!params.callbackBaseUrl) {
        return err(domainError('INTERNAL', 'Missing callback base URL for redirect checkout'));
      }

      const tranId = newId();
      const amount = input.amount.toFixed(2);

      await repo.createOrder(params.organizationId, {
        providerOrderId: tranId,
        provider: 'sslcommerz',
        amount,
        currency: 'BDT',
        donorName: input.donorName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        categoryName: input.categoryName ?? null,
      });

      const callback = `${params.callbackBaseUrl.replace(/\/$/, '')}/api/payments/sslcommerz/callback`;
      const session = await sslcommerz.createSession({
        tranId,
        amount,
        customerName: input.donorName,
        customerEmail: input.email ?? null,
        customerPhone: input.phone ?? null,
        description: 'Temple donation',
        successUrl: callback,
        failUrl: `${callback}?outcome=failed`,
        cancelUrl: `${callback}?outcome=cancelled`,
      });

      return ok({ kind: 'sslcommerz', gatewayUrl: session.gatewayUrl });
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
        email: result.email,
        alreadyPaid: result.alreadyPaid,
      });
    },

    /**
     * SSLCommerz return-leg confirm: validate the val_id with the gateway,
     * cross-check amount/currency against our order row, then record. The
     * callback body itself is never trusted.
     */
    async confirmSslcommerzDonation(
      organizationId: string,
      rawInput: unknown,
    ): Promise<Result<ConfirmedDonation>> {
      const sslcommerz = sslcommerzFromEnv();
      if (!sslcommerz) {
        return err(domainError('VALIDATION', 'Online donations are not configured'));
      }
      const parsed = confirmSslcommerzSchema.safeParse(rawInput);
      if (!parsed.success) {
        return err(domainError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid input'));
      }

      const validation = await sslcommerz.validatePayment(parsed.data.valId);
      if (validation.status !== 'VALID' && validation.status !== 'VALIDATED') {
        return err(domainError('FORBIDDEN', 'Payment could not be verified'));
      }

      const order = await repo.findByProviderOrderId(organizationId, validation.tranId);
      if (!order || order.provider !== 'sslcommerz') return err(notFound('Donation order'));
      if (Number(validation.amount) !== Number(order.amount) || validation.currency !== 'BDT') {
        return err(domainError('FORBIDDEN', 'Payment details do not match the order'));
      }

      const result = await repo.confirmPaid(
        organizationId,
        validation.tranId,
        validation.bankTranId || parsed.data.valId,
      );
      if (result.kind === 'order_not_found') return err(notFound('Donation order'));

      const d = result.donation;
      return ok({
        receiptNumber: d.receiptNumber,
        amount: d.amount,
        currency: d.currency,
        donorName: d.donorName,
        email: result.email,
        alreadyPaid: result.alreadyPaid,
      });
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
