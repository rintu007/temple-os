import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  auditLogs,
  organizations,
  planCatalog,
  platformAdmins,
  platformSubscriptions,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { PlatformOverrideInput } from '@templeos/validators';

/**
 * Cross-tenant reads for platform staff. Every method scopes via
 * withTenantContext(db, { userId }) with organizationId omitted, so RLS's
 * app_is_platform_admin() policies (packages/db/sql/0004) are what actually
 * grant visibility — there is no bypass-RLS connection involved.
 */
const ORG_BILLING_COLUMNS = {
  id: organizations.id,
  name: organizations.name,
  slug: organizations.slug,
  country: organizations.country,
  orgStatus: organizations.status,
  createdAt: organizations.createdAt,
  plan: platformSubscriptions.plan,
  subscriptionStatus: platformSubscriptions.status,
  trialEndsAt: platformSubscriptions.trialEndsAt,
  currentPeriodEnd: platformSubscriptions.currentPeriodEnd,
};

export function createPlatformRepository(db: Db) {
  return {
    async isPlatformAdmin(userId: string): Promise<boolean> {
      return withTenantContext(db, { userId }, async (tx) => {
        const [row] = await tx
          .select({ userId: platformAdmins.userId })
          .from(platformAdmins)
          .where(eq(platformAdmins.userId, userId))
          .limit(1);
        return row !== undefined;
      });
    },

    async listOrganizationsWithBilling(userId: string) {
      return withTenantContext(db, { userId }, async (tx) => {
        return tx
          .select(ORG_BILLING_COLUMNS)
          .from(organizations)
          .leftJoin(platformSubscriptions, eq(platformSubscriptions.organizationId, organizations.id))
          .where(isNull(organizations.deletedAt))
          .orderBy(desc(organizations.createdAt));
      });
    },

    async getOrganizationWithBilling(userId: string, organizationId: string) {
      return withTenantContext(db, { userId }, async (tx) => {
        const [row] = await tx
          .select(ORG_BILLING_COLUMNS)
          .from(organizations)
          .leftJoin(platformSubscriptions, eq(platformSubscriptions.organizationId, organizations.id))
          .where(and(eq(organizations.id, organizationId), isNull(organizations.deletedAt)))
          .limit(1);
        return row ?? null;
      });
    },

    /**
     * Support override of one org's billing state — comp a plan, un-stick a
     * past_due account, or extend a trial. Scoped via withTenantContext with
     * the TARGET org's id: the actor's platform-admin status was already
     * checked by the service before this runs, so the ordinary tenant-scoped
     * RLS policies (not a bypass role) are sufficient to allow the write.
     */
    async applyOverride(organizationId: string, actorUserId: string, input: PlatformOverrideInput) {
      return withTenantContext(db, { organizationId, userId: actorUserId }, async (tx) => {
        const [before] = await tx
          .select()
          .from(platformSubscriptions)
          .where(eq(platformSubscriptions.organizationId, organizationId))
          .limit(1);

        const baseTrialEnd =
          before?.trialEndsAt && before.trialEndsAt.getTime() > Date.now()
            ? before.trialEndsAt
            : new Date();
        const trialEndsAt = input.extendTrialDays
          ? new Date(baseTrialEnd.getTime() + input.extendTrialDays * 86_400_000)
          : undefined;

        let plan = input.plan ?? before?.plan;
        if (!plan) {
          const [trialPlan] = await tx
            .select({ key: planCatalog.key })
            .from(planCatalog)
            .where(eq(planCatalog.isTrialDefault, true))
            .limit(1);
          if (!trialPlan) throw new Error('No plan is marked as the trial default');
          plan = trialPlan.key;
        }
        const status = input.status ?? before?.status ?? 'trialing';

        await tx
          .insert(platformSubscriptions)
          .values({ organizationId, plan, status, ...(trialEndsAt ? { trialEndsAt } : {}) })
          .onConflictDoUpdate({
            target: platformSubscriptions.organizationId,
            set: { plan, status, ...(trialEndsAt ? { trialEndsAt } : {}) },
          });

        await tx.insert(auditLogs).values({
          organizationId,
          actorUserId,
          action: 'platform.subscription_overridden',
          entityType: 'platform_subscription',
          entityId: organizationId,
          before: before
            ? {
                plan: before.plan,
                status: before.status,
                trialEndsAt: before.trialEndsAt?.toISOString() ?? null,
              }
            : null,
          after: {
            plan,
            status,
            trialEndsAt: (trialEndsAt ?? before?.trialEndsAt)?.toISOString() ?? null,
          },
        });
      });
    },

    /** Suspend/reactivate an org — blocks its staff from the admin dashboard (see requireTenantContext). */
    async setOrganizationStatus(
      organizationId: string,
      actorUserId: string,
      status: 'active' | 'suspended',
    ) {
      return withTenantContext(db, { organizationId, userId: actorUserId }, async (tx) => {
        const [before] = await tx
          .select({ status: organizations.status })
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1);

        await tx.update(organizations).set({ status }).where(eq(organizations.id, organizationId));

        await tx.insert(auditLogs).values({
          organizationId,
          actorUserId,
          action: status === 'suspended' ? 'platform.org_suspended' : 'platform.org_reactivated',
          entityType: 'organization',
          entityId: organizationId,
          before: before ? { status: before.status } : null,
          after: { status },
        });
      });
    },
  };
}

export type PlatformRepository = ReturnType<typeof createPlatformRepository>;
