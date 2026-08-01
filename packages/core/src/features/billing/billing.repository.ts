import { and, eq, sql } from 'drizzle-orm';
import {
  memberships,
  organizations,
  platformSubscriptions,
  roles,
  users,
  withTenantContext,
  type Db,
} from '@templeos/db';
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
     *
     * `becamePastDue` is true only on the transition INTO past_due (compares
     * against the row's status before this update), not on every webhook
     * delivery while a subscription stays past_due — Stripe retries and
     * re-sends `customer.subscription.updated`, and the caller uses this
     * flag to decide whether to send a "payment failed" email, which must
     * not repeat on every retry.
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
    ): Promise<{ applied: boolean; becamePastDue: boolean }> {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [before] = await tx
          .select({ status: platformSubscriptions.status })
          .from(platformSubscriptions)
          .where(eq(platformSubscriptions.organizationId, organizationId))
          .limit(1);

        const result = await tx
          .update(platformSubscriptions)
          .set(values)
          .where(eq(platformSubscriptions.organizationId, organizationId))
          .returning({ organizationId: platformSubscriptions.organizationId });

        const applied = result.length > 0;
        const becamePastDue = applied && values.status === 'past_due' && before?.status !== 'past_due';
        return { applied, becamePastDue };
      });
    },

    /**
     * Owner contact(s) for a billing notice email. Org-scoped only (no
     * userId) — the same trust model as syncFromStripe above, and RLS
     * already permits this under org-scope alone: memberships/roles are
     * organization_id-scoped, and users_same_org_read only checks for a
     * membership row in the session's org, not who the caller is.
     */
    async getBillingNoticeContext(
      organizationId: string,
    ): Promise<{ organizationName: string; owners: Array<{ email: string; fullName: string | null }> }> {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [org] = await tx
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1);

        const owners = await tx
          .select({ email: users.email, fullName: users.fullName })
          .from(memberships)
          .innerJoin(roles, eq(memberships.roleId, roles.id))
          .innerJoin(users, eq(memberships.userId, users.id))
          .where(
            and(
              eq(memberships.organizationId, organizationId),
              eq(memberships.status, 'active'),
              eq(roles.key, 'owner'),
            ),
          );

        return { organizationName: org?.name ?? 'your temple', owners };
      });
    },

    /**
     * Cross-tenant scan for the trial-ending-soon reminder cron — see
     * packages/db/sql/0006_billing_notice_function.sql for why this needs a
     * narrowly-scoped SECURITY DEFINER function rather than ordinary
     * org-scoped RLS (there is no bypass-RLS credential available in
     * production for a job like this to iterate every organization).
     */
    async listTrialsEndingSoon(daysAhead: number): Promise<
      Array<{
        organizationId: string;
        organizationName: string;
        trialEndsAt: Date;
        ownerEmail: string;
        ownerName: string | null;
      }>
    > {
      const rows = await db.execute<{
        organization_id: string;
        organization_name: string;
        trial_ends_at: Date;
        owner_email: string;
        owner_name: string | null;
      }>(sql`SELECT * FROM app_list_trials_ending_soon(${daysAhead})`);
      return rows.map((r) => ({
        organizationId: r.organization_id,
        organizationName: r.organization_name,
        trialEndsAt: r.trial_ends_at,
        ownerEmail: r.owner_email,
        ownerName: r.owner_name,
      }));
    },

    async markTrialReminderSent(organizationId: string): Promise<void> {
      await withTenantContext(db, { organizationId }, async (tx) => {
        await tx
          .update(platformSubscriptions)
          .set({ trialReminderSentAt: new Date() })
          .where(eq(platformSubscriptions.organizationId, organizationId));
      });
    },
  };
}

export type BillingRepository = ReturnType<typeof createBillingRepository>;
