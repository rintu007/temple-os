import type { Db } from '@templeos/db';
import {
  PLAN_MODULES,
  PURCHASABLE_PLANS,
  type ModuleKey,
  type PlatformPlan,
} from '@templeos/validators';
import { authorize, domainError, err, ok, type Result, type TenantContext } from '../../shared';
import { createBillingRepository } from './billing.repository';
import { priceIdForPlan, stripeBillingFromEnv, type StripeBillingClient } from './stripe-billing';
import type { BillingStatus, PlatformSubscriptionStatus } from './billing.types';

function toStatus(row: {
  plan: PlatformPlan;
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

function isPurchasablePlan(plan: string): plan is (typeof PURCHASABLE_PLANS)[number] {
  return (PURCHASABLE_PLANS as readonly string[]).includes(plan);
}

export function createBillingService({ db }: { db: Db }) {
  const repo = createBillingRepository(db);

  return {
    isConfigured(plan: PlatformPlan = 'pro'): boolean {
      return stripeBillingFromEnv() !== null && priceIdForPlan(plan) !== null;
    },

    async getStatus(ctx: TenantContext): Promise<Result<BillingStatus | null>> {
      const guard = authorize(ctx, 'organization:manage');
      if (!guard.ok) return guard;
      const row = await repo.getSubscription(ctx);
      return ok(row ? toStatus(row) : null);
    },

    /**
     * Which gateable modules (packages/validators/src/billing.ts#ModuleKey)
     * this org can use right now. 'all' covers: no subscription row at all
     * (orgs provisioned before platform billing existed — fail-open rather
     * than lock out existing customers), and an active, non-expired trial.
     * Everything else resolves to its plan's module list, falling back to
     * Starter (no gated modules, core operations only) once a trial expires
     * or a subscription lapses — never to zero access, since the temple's
     * own site and donation intake must keep working regardless of billing.
     */
    async getEntitledModules(ctx: TenantContext): Promise<'all' | ReadonlySet<ModuleKey>> {
      const row = await repo.getSubscription(ctx);
      if (!row) return 'all';

      const isTrialExpired =
        row.status === 'trialing' && row.trialEndsAt !== null && row.trialEndsAt.getTime() < Date.now();
      if (row.status === 'trialing' && !isTrialExpired) return 'all';
      if (row.status === 'active') return new Set(PLAN_MODULES[row.plan]);
      return new Set(PLAN_MODULES.starter);
    },

    /** Starts (or resumes) Stripe Checkout for a paid plan (Growth or Pro). */
    async createUpgradeCheckout(
      ctx: TenantContext,
      plan: PlatformPlan,
      callbackBaseUrl: string,
    ): Promise<Result<{ gatewayUrl: string }>> {
      const guard = authorize(ctx, 'organization:manage');
      if (!guard.ok) return guard;
      if (!isPurchasablePlan(plan)) {
        return err(domainError('VALIDATION', 'That plan cannot be purchased directly'));
      }

      const stripe = stripeBillingFromEnv();
      const priceId = priceIdForPlan(plan);
      if (!stripe || !priceId) {
        return err(domainError('VALIDATION', 'Billing is not configured yet'));
      }

      const existing = await repo.getSubscription(ctx);
      const base = callbackBaseUrl.replace(/\/$/, '');

      const session = await stripe.createSubscriptionCheckoutSession({
        organizationId: ctx.organizationId,
        plan,
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
        const plan = session.metadata?.plan;
        const customerId = typeof session.customer === 'string' ? session.customer : null;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
        if (!organizationId || !customerId || !plan || !isPurchasablePlan(plan)) {
          return { outcome: 'ignored' as const, reason: 'missing organizationId, plan, or customer' };
        }
        const applied = await repo.syncFromStripe(organizationId, {
          plan,
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
        const plan = subscription.metadata?.plan;
        const applied = await repo.syncFromStripe(organizationId, {
          ...(plan && isPurchasablePlan(plan) ? { plan } : {}),
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
