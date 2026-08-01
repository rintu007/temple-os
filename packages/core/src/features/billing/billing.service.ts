import type { Db } from '@templeos/db';
import type { ModuleKey, PlanCatalogEntry, PlatformPlan } from '@templeos/validators';
import { authorize, domainError, err, ok, type Result, type TenantContext } from '../../shared';
import { createPlanRepository } from '../plans/plan.repository';
import { createBillingRepository } from './billing.repository';
import { stripeBillingFromEnv, type StripeBillingClient } from './stripe-billing';
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

export function createBillingService({ db }: { db: Db }) {
  const repo = createBillingRepository(db);
  const planRepo = createPlanRepository(db);

  return {
    /** Takes an already-fetched plan (from planService().listPlans()) to avoid a redundant DB round trip per card. */
    isConfigured(plan: PlanCatalogEntry): boolean {
      return stripeBillingFromEnv() !== null && plan.stripePriceId !== null;
    },

    async getStatus(ctx: TenantContext): Promise<Result<BillingStatus | null>> {
      const guard = authorize(ctx, 'organization:manage');
      if (!guard.ok) return guard;
      const row = await repo.getSubscription(ctx);
      return ok(row ? toStatus(row) : null);
    },

    /**
     * Which gateable modules (packages/validators/src/billing.ts#ModuleKey)
     * this org can use right now. 'all' covers only orgs with no subscription
     * row at all (provisioned before platform billing existed — fail-open
     * rather than lock out existing customers). Every other case resolves to
     * a real plan's own module list: the org's own plan while active or
     * mid-trial (unexpired), or the catalog's fallback-default plan once a
     * trial expires or a subscription lapses — never to zero access from a
     * missing catalog row, since the temple's own site and donation intake
     * must keep working regardless of billing.
     */
    async getEntitledModules(ctx: TenantContext): Promise<'all' | ReadonlySet<ModuleKey>> {
      const row = await repo.getSubscription(ctx);
      if (!row) return 'all';

      const isTrialExpired =
        row.status === 'trialing' && row.trialEndsAt !== null && row.trialEndsAt.getTime() < Date.now();
      const usesOwnPlan = row.status === 'active' || (row.status === 'trialing' && !isTrialExpired);

      const plan = usesOwnPlan
        ? await planRepo.getByKey(row.plan)
        : await planRepo.getFallbackDefault();
      return new Set(plan?.modules ?? []);
    },

    /** Starts (or resumes) Stripe Checkout for a purchasable plan. */
    async createUpgradeCheckout(
      ctx: TenantContext,
      plan: PlatformPlan,
      callbackBaseUrl: string,
    ): Promise<Result<{ gatewayUrl: string }>> {
      const guard = authorize(ctx, 'organization:manage');
      if (!guard.ok) return guard;

      const planRow = await planRepo.getByKey(plan);
      if (!planRow?.isPurchasable) {
        return err(domainError('VALIDATION', 'That plan cannot be purchased directly'));
      }

      const stripe = stripeBillingFromEnv();
      if (!stripe || !planRow.stripePriceId) {
        return err(domainError('VALIDATION', 'Billing is not configured yet'));
      }

      const existing = await repo.getSubscription(ctx);
      const base = callbackBaseUrl.replace(/\/$/, '');

      const session = await stripe.createSubscriptionCheckoutSession({
        organizationId: ctx.organizationId,
        plan,
        priceId: planRow.stripePriceId,
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

    /** Owner contact(s) to notify for a billing event on this org — used by the webhook route and the trial-reminder cron. */
    async getBillingNoticeContext(organizationId: string) {
      return repo.getBillingNoticeContext(organizationId);
    },

    /** Trialing orgs whose trial ends within `daysAhead` days and haven't been reminded yet — used by the trial-reminder cron route. */
    async listTrialsEndingSoon(daysAhead: number) {
      return repo.listTrialsEndingSoon(daysAhead);
    },

    /** Marks a trial as reminded so the cron never emails the same org twice for the same trial. */
    async markTrialReminderSent(organizationId: string) {
      return repo.markTrialReminderSent(organizationId);
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
        if (!organizationId || !customerId || !plan) {
          return { outcome: 'ignored' as const, reason: 'missing organizationId, plan, or customer' };
        }
        const planRow = await planRepo.getByKey(plan);
        if (!planRow?.isPurchasable) {
          return { outcome: 'ignored' as const, reason: 'plan is not purchasable' };
        }
        const { applied } = await repo.syncFromStripe(organizationId, {
          plan,
          status: 'active',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });
        return applied
          ? { outcome: 'confirmed' as const, organizationId, becamePastDue: false }
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
        const planRow = plan ? await planRepo.getByKey(plan) : null;
        const { applied, becamePastDue } = await repo.syncFromStripe(organizationId, {
          ...(planRow?.isPurchasable ? { plan: planRow.key } : {}),
          status,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null,
        });
        return applied
          ? { outcome: 'confirmed' as const, organizationId, becamePastDue }
          : { outcome: 'ignored' as const, reason: 'organization not found' };
      }

      return { outcome: 'ignored' as const, reason: `event ${event.type}` };
    },
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
