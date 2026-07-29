import Stripe from 'stripe';

/**
 * Global checkout rail — every currency other than INR (Razorpay) and BDT
 * (SSLCommerz) routes through Stripe Checkout. Unlike those two, this wraps
 * the official SDK rather than raw REST: Stripe's API surface (and its
 * webhook signature scheme) is large enough that hand-rolling it isn't worth
 * the risk.
 */

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string | null;
}

export interface CreateCheckoutSessionParams {
  /** Our payment_orders.providerOrderId will be set to the resulting session id. */
  tranId: string;
  /** Smallest currency unit (cents), integer. */
  amountMinor: number;
  currency: 'usd' | 'gbp' | 'cad' | 'aud';
  donorName: string;
  email: string | null;
  description: string;
  organizationId: string;
  successUrl: string;
  cancelUrl: string;
}

export class StripeClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeClientError';
  }
}

export function createStripeClient({ secretKey, webhookSecret }: StripeConfig) {
  const stripe = new Stripe(secretKey);

  return {
    webhookSecret,

    async createCheckoutSession(
      params: CreateCheckoutSessionParams,
    ): Promise<{ sessionId: string; gatewayUrl: string }> {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: params.email ?? undefined,
        client_reference_id: params.tranId,
        line_items: [
          {
            price_data: {
              currency: params.currency,
              unit_amount: params.amountMinor,
              product_data: { name: params.description },
            },
            quantity: 1,
          },
        ],
        metadata: {
          tranId: params.tranId,
          organizationId: params.organizationId,
          donorName: params.donorName,
        },
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
      });
      if (!session.url) throw new StripeClientError('Stripe did not return a checkout URL');
      return { sessionId: session.id, gatewayUrl: session.url };
    },

    /** Server-side lookup for the return leg — never trust query params alone. */
    async retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session> {
      return stripe.checkout.sessions.retrieve(sessionId);
    },

    /** Verifies the raw webhook body against the registered endpoint secret. */
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

export type StripeClient = ReturnType<typeof createStripeClient>;

/** Builds a client from env, or null when global card payments are not configured. */
export function stripeFromEnv(): StripeClient | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return createStripeClient({
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
  });
}
