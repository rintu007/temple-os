import Stripe from 'stripe';

/**
 * TempleOS's own subscription billing — separate Stripe integration from
 * `packages/core/src/features/payments/stripe.ts` (which is devotee donation
 * checkout). Different concern, different Stripe webhook endpoint/secret, so
 * kept as its own small client rather than shared.
 */

export interface StripeBillingConfig {
  secretKey: string;
  webhookSecret: string | null;
}

export interface CreateSubscriptionCheckoutParams {
  organizationId: string;
  priceId: string;
  /** Reuse the existing Stripe customer if this org has billed before. */
  existingCustomerId: string | null;
  successUrl: string;
  cancelUrl: string;
}

export class StripeBillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeBillingError';
  }
}

export function createStripeBillingClient({ secretKey, webhookSecret }: StripeBillingConfig) {
  const stripe = new Stripe(secretKey);

  return {
    webhookSecret,

    async createSubscriptionCheckoutSession(
      params: CreateSubscriptionCheckoutParams,
    ): Promise<{ gatewayUrl: string }> {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: params.existingCustomerId ?? undefined,
        line_items: [{ price: params.priceId, quantity: 1 }],
        metadata: { organizationId: params.organizationId },
        subscription_data: { metadata: { organizationId: params.organizationId } },
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
      });
      if (!session.url) throw new StripeBillingError('Stripe did not return a checkout URL');
      return { gatewayUrl: session.url };
    },

    /** Self-serve plan management (update card, cancel, view invoices). */
    async createPortalSession(customerId: string, returnUrl: string): Promise<{ gatewayUrl: string }> {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return { gatewayUrl: session.url };
    },

    constructWebhookEvent(rawBody: string, signature: string): Stripe.Event | null {
      if (!webhookSecret) return null;
      try {
        return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch {
        return null;
      }
    },
  };
}

export type StripeBillingClient = ReturnType<typeof createStripeBillingClient>;

/** Builds a client from env, or null when platform billing is not configured. */
export function stripeBillingFromEnv(): StripeBillingClient | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return createStripeBillingClient({
    secretKey,
    webhookSecret: process.env.STRIPE_BILLING_WEBHOOK_SECRET ?? null,
  });
}

/** The Stripe Price id for the Pro monthly plan — configured once in the Stripe dashboard. */
export function proPriceIdFromEnv(): string | null {
  return process.env.STRIPE_PRICE_PRO_MONTHLY ?? null;
}
