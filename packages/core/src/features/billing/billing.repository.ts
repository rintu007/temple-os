import { eq } from 'drizzle-orm';
import { platformSubscriptions, withTenantContext, type Db } from '@templeos/db';
import type { PlatformPlan } from '@templeos/validators';
import type { TenantContext } from '../../shared';
import type { PlatformSubscriptionStatus } from './billing.types';

export function createBillingRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async getSubscription(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select()
          .from(platformSubscriptions)
          .where(eq(platformSubscriptions.organizationId, ctx.organizationId))
          .limit(1);
        return row ?? null;
      });
    },

    async setStripeCustomer(ctx: TenantContext, stripeCustomerId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        await tx
          .update(platformSubscriptions)
          .set({ stripeCustomerId })
          .where(eq(platformSubscriptions.organizationId, ctx.organizationId));
      });
    },

    /**
     * Webhook path: no signed-in user, so there is no TenantContext — every
     * Stripe event we handle carries organizationId in its own metadata
     * (set at checkout/subscription creation time), so scoping directly by
     * organizationId here is the same trust model the payment webhooks use.
     */
    async syncFromStripe(
      organizationId: string,
      values: {
        plan?: PlatformPlan;
        status: PlatformSubscriptionStatus;
        stripeCustomerId?: string;
        stripeSubscriptionId?: string | null;
        currentPeriodEnd?: Date | null;
      },
    ): Promise<boolean> {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const result = await tx
          .update(platformSubscriptions)
          .set(values)
          .where(eq(platformSubscriptions.organizationId, organizationId))
          .returning({ organizationId: platformSubscriptions.organizationId });
        return result.length > 0;
      });
    },
  };
}

export type BillingRepository = ReturnType<typeof createBillingRepository>;
