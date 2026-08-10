import { newId, type Db } from '@templeos/db';
import {
  confirmDonationOrderSchema,
  confirmSslcommerzSchema,
  createDonationOrderSchema,
} from '@templeos/validators';
import { authorize, domainError, err, notFound, ok, type Result, type TenantContext } from '../../shared';
import { createPaymentOrderRepository } from './order.repository';
import { razorpayFromEnv } from './razorpay';
import { sslcommerzFromEnv } from './sslcommerz';
import { stripeFromEnv } from './stripe';
import type { ConfirmedDonation, DonationOrder, GlobalCurrency } from './order.types';

const STRIPE_CURRENCY_CODES: Record<GlobalCurrency, 'usd' | 'gbp' | 'cad' | 'aud'> = {
  USD: 'usd',
  GBP: 'gbp',
  CAD: 'cad',
  AUD: 'aud',
};

export interface CreateDonationOrderParams {
  organizationId: string;
  organizationCurrency: 'INR' | 'BDT' | GlobalCurrency;
  rawInput: unknown;
  /** Absolute origin of the tenant site (e.g. https://demo.templeos.com) —
   *  required for redirect providers (SSLCommerz, Stripe) to build return URLs. */
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
    /** INR → Razorpay; BDT → SSLCommerz; everything else → Stripe. Each activates when its env keys exist. */
    isOnlineCheckoutAvailable(currency: 'INR' | 'BDT' | GlobalCurrency): boolean {
      if (currency === 'INR') return razorpayFromEnv() !== null;
      if (currency === 'BDT') return sslcommerzFromEnv() !== null;
      return stripeFromEnv() !== null;
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

      if (params.organizationCurrency === 'BDT') {
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
      }

      // Everything else (USD/GBP/CAD/AUD) — Stripe Checkout (redirect flow)
      const stripe = stripeFromEnv();
      if (!stripe) {
        return err(
          domainError('VALIDATION', 'Online donations are not yet available for this currency'),
        );
      }
      if (!params.callbackBaseUrl) {
        return err(domainError('INTERNAL', 'Missing callback base URL for redirect checkout'));
      }

      const tranId = newId();
      const amount = input.amount.toFixed(2);
      const currency = params.organizationCurrency;

      const callback = `${params.callbackBaseUrl.replace(/\/$/, '')}/api/payments/stripe/callback`;
      // Stripe assigns the order identifier (the checkout session id), so the
      // session is created first and the order row is keyed off its id —
      // unlike SSLCommerz, where we mint tranId ourselves up front.
      const session = await stripe.createCheckoutSession({
        tranId,
        amountMinor: Math.round(input.amount * 100),
        currency: STRIPE_CURRENCY_CODES[currency],
        donorName: input.donorName,
        email: input.email ?? null,
        description: 'Temple donation',
        organizationId: params.organizationId,
        successUrl: `${callback}?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${callback}?outcome=cancelled`,
      });

      await repo.createOrder(params.organizationId, {
        providerOrderId: session.sessionId,
        provider: 'stripe',
        amount,
        currency,
        donorName: input.donorName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        categoryName: input.categoryName ?? null,
      });

      return ok({ kind: 'stripe', gatewayUrl: session.gatewayUrl });
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

    /**
     * Stripe return-leg confirm: re-fetch the Checkout Session server-side
     * (never trust the redirect query string), cross-check it against our
     * order row, then record. Mirrors confirmSslcommerzDonation — the webhook
     * handles the case where the devotee closes the tab before returning.
     */
    async confirmStripeDonation(
      organizationId: string,
      sessionId: string,
    ): Promise<Result<ConfirmedDonation>> {
      const stripe = stripeFromEnv();
      if (!stripe) {
        return err(domainError('VALIDATION', 'Online donations are not configured'));
      }

      const session = await stripe.retrieveSession(sessionId);
      if (session.payment_status !== 'paid') {
        return err(domainError('FORBIDDEN', 'Payment could not be verified'));
      }

      const order = await repo.findByProviderOrderId(organizationId, sessionId);
      if (!order || order.provider !== 'stripe') return err(notFound('Donation order'));
      const amountTotal = ((session.amount_total ?? 0) / 100).toFixed(2);
      if (
        amountTotal !== Number(order.amount).toFixed(2) ||
        session.currency?.toUpperCase() !== order.currency
      ) {
        return err(domainError('FORBIDDEN', 'Payment details do not match the order'));
      }

      const paymentIntentId =
        typeof session.payment_intent === 'string' ? session.payment_intent : sessionId;
      const result = await repo.confirmPaid(organizationId, sessionId, paymentIntentId);
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

    /** Called from the SSLCommerz return-leg when the gateway reports fail/cancel (no webhook exists for this provider). */
    async markFailed(organizationId: string, providerOrderId: string, reason: string): Promise<void> {
      await repo.markFailed(organizationId, providerOrderId, reason);
    },

    /** Staff-facing: failed + abandoned checkout attempts, so a devotee's failed payment doesn't go unnoticed. */
    async listRecentFailures(ctx: TenantContext): Promise<Result<Awaited<ReturnType<typeof repo.listRecentFailures>>>> {
      const guard = authorize(ctx, 'donations:read');
      if (!guard.ok) return guard;
      return ok(await repo.listRecentFailures(ctx.organizationId));
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
