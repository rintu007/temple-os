import type { Db } from '@templeos/db';
import { authorize, domainError, err, ok, type Result, type TenantContext } from '../../shared';
import { createBillingRepository } from './billing.repository';
import {
  proPriceIdFromEnv,
  stripeBillingFromEnv,
  type StripeBillingClient,
} from './stripe-billing';
import type { BillingStatus, PlatformSubscriptionStatus } from './billing.types';

function toStatus(row: {
  plan: 'trial' | 'pro';
  status: PlatformSubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
}): BillingStatus {
  return {
    plan: row.plan,
    status: row.status,
    trialEndsAt: row.trialEndsAt,
    currentPeriodEnd: row.currentPeriodEnd,
    hasStripeCustomer: row.stripeCustomerId !== null,
    isTrialExpired:
      row.status === 'trialing' && row.trialEndsAt !== null && row.trialEndsAt.getTime() < Date.now(),
  };
}

/** Maps Stripe's subscription status vocabulary onto our narrower enum. */
function mapStripeStatus(stripeStatus: string): PlatformSubscriptionStatus {
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return stripeStatus;
  if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') return 'past_due';
  return 'canceled';
}

export function createBillingService({ db }: { db: Db }) {
  const repo = createBillingRepository(db);

  return {
    isConfigured(): boolean {
      return stripeBillingFromEnv() !== null && proPriceIdFromEnv() !== null;
    },

    async getStatus(ctx: TenantContext): Promise<Result<BillingStatus | null>> {
      const guard = authorize(ctx, 'organization:manage');
      if (!guard.ok) return guard;
      const row = await repo.getSubscription(ctx);
      return ok(row ? toStatus(row) : null);
    },

    /** Starts (or resumes) Stripe Checkout for the Pro monthly plan. */
    async createUpgradeCheckout(
      ctx: TenantContext,
      callbackBaseUrl: string,
    ): Promise<Result<{ gatewayUrl: string }>> {
      const guard = authorize(ctx, 'organization:manage');
      if (!guard.ok) return guard;

      const stripe = stripeBillingFromEnv();
      const priceId = proPriceIdFromEnv();
      if (!stripe || !priceId) {
        return err(domainError('VALIDATION', 'Billing is not configured yet'));
      }

      const existing = await repo.getSubscription(ctx);
      const base = callbackBaseUrl.replace(/\/$/, '');

      const session = await stripe.createSubscriptionCheckoutSession({
        organizationId: ctx.organizationId,
        priceId,
        existingCustomerId: existing?.stripeCustomerId ?? null,
        successUrl: `${base}/billing?checkout=success`,
        cancelUrl: `${base}/billing?checkout=cancelled`,
      });
      return ok(session);
    },

    /** Self-serve billing portal — only once the org has a Stripe customer (i.e. has checked out once). */
    async createPortalSession(
      ctx: TenantContext,
      callbackBaseUrl: string,
    ): Promise<Result<{ gatewayUrl: string }>> {
      const guard = authorize(ctx, 'organization:manage');
      if (!guard.ok) return guard;

      const stripe = stripeBillingFromEnv();
      if (!stripe) return err(domainError('VALIDATION', 'Billing is not configured yet'));

      const existing = await repo.getSubscription(ctx);
      if (!existing?.stripeCustomerId) {
        return err(domainError('VALIDATION', 'Upgrade to a paid plan before managing billing'));
      }

      const session = await stripe.createPortalSession(
        existing.stripeCustomerId,
        `${callbackBaseUrl.replace(/\/$/, '')}/billing`,
      );
      return ok(session);
    },

    async handleStripeEvent(rawBody: string, signature: string, client?: StripeBillingClient) {
      const stripe = client ?? stripeBillingFromEnv();
      if (!stripe || !stripe.webhookSecret) return { outcome: 'not_configured' as const };

      const event = stripe.constructWebhookEvent(rawBody, signature);
      if (!event) return { outcome: 'invalid_signature' as const };

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as {
          mode?: string;
          customer?: string | null;
          subscription?: string | null;
          metadata?: Record<string, string> | null;
        };
        if (session.mode !== 'subscription') {
          return { outcome: 'ignored' as const, reason: 'not a subscription checkout' };
        }
        const organizationId = session.metadata?.organizationId;
        const customerId = typeof session.customer === 'string' ? session.customer : null;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
        if (!organizationId || !customerId) {
          return { outcome: 'ignored' as const, reason: 'missing organizationId or customer' };
        }
        const applied = await repo.syncFromStripe(organizationId, {
          plan: 'pro',
          status: 'active',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });
        return applied
          ? { outcome: 'confirmed' as const }
          : { outcome: 'ignored' as const, reason: 'organization not found' };
      }

      if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as {
          status?: string;
          current_period_end?: number;
          metadata?: Record<string, string> | null;
        };
        const organizationId = subscription.metadata?.organizationId;
        if (!organizationId) return { outcome: 'ignored' as const, reason: 'no organizationId in metadata' };

        const status =
          event.type === 'customer.subscription.deleted'
            ? 'canceled'
            : mapStripeStatus(subscription.status ?? 'canceled');
        const applied = await repo.syncFromStripe(organizationId, {
          status,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null,
        });
        return applied
          ? { outcome: 'confirmed' as const }
          : { outcome: 'ignored' as const, reason: 'organization not found' };
      }

      return { outcome: 'ignored' as const, reason: `event ${event.type}` };
    },
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
