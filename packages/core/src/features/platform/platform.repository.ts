import { desc, eq, isNull } from 'drizzle-orm';
import { organizations, platformAdmins, platformSubscriptions, withTenantContext, type Db } from '@templeos/db';

/**
 * Cross-tenant reads for platform staff. Every method scopes via
 * withTenantContext(db, { userId }) with organizationId omitted, so RLS's
 * app_is_platform_admin() policies (packages/db/sql/0004) are what actually
 * grant visibility — there is no bypass-RLS connection involved.
 */
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
          .select({
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
          })
          .from(organizations)
          .leftJoin(platformSubscriptions, eq(platformSubscriptions.organizationId, organizations.id))
          .where(isNull(organizations.deletedAt))
          .orderBy(desc(organizations.createdAt));
      });
    },
  };
}

export type PlatformRepository = ReturnType<typeof createPlatformRepository>;
