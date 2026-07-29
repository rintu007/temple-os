import type { Db } from '@templeos/db';
import { PLAN_CATALOG } from '@templeos/validators';
import { err, forbidden, ok, type Result } from '../../shared';
import { createPlatformRepository } from './platform.repository';
import type { PlatformOrgSummary, PlatformOverview } from './platform.types';

export function createPlatformService({ db }: { db: Db }) {
  const repo = createPlatformRepository(db);

  return {
    isPlatformAdmin(userId: string): Promise<boolean> {
      return repo.isPlatformAdmin(userId);
    },

    /** Read-only cross-tenant ops view: every org's plan, status, and MRR contribution. */
    async getOverview(userId: string): Promise<Result<PlatformOverview>> {
      if (!(await repo.isPlatformAdmin(userId))) {
        return err(forbidden('Platform admin access required'));
      }

      const rows = await repo.listOrganizationsWithBilling(userId);
      const organizationSummaries: PlatformOrgSummary[] = rows.map((row) => {
        const isTrialExpired =
          row.subscriptionStatus === 'trialing' &&
          row.trialEndsAt !== null &&
          row.trialEndsAt.getTime() < Date.now();
        const mrrUsd =
          row.subscriptionStatus === 'active' && row.plan
            ? (PLAN_CATALOG[row.plan].priceUsd ?? 0)
            : 0;

        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          country: row.country,
          orgStatus: row.orgStatus,
          createdAt: row.createdAt,
          plan: row.plan,
          subscriptionStatus: row.subscriptionStatus,
          trialEndsAt: row.trialEndsAt,
          currentPeriodEnd: row.currentPeriodEnd,
          isTrialExpired,
          mrrUsd,
        };
      });

      return ok({
        organizations: organizationSummaries,
        totalOrganizations: organizationSummaries.length,
        totalMrrUsd: organizationSummaries.reduce((sum, o) => sum + o.mrrUsd, 0),
        activeSubscriptions: organizationSummaries.filter((o) => o.subscriptionStatus === 'active')
          .length,
        trialing: organizationSummaries.filter(
          (o) => o.subscriptionStatus === 'trialing' && !o.isTrialExpired,
        ).length,
      });
    },
  };
}

export type PlatformService = ReturnType<typeof createPlatformService>;
