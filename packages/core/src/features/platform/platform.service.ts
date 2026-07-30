import type { Db } from '@templeos/db';
import {
  PLAN_CATALOG,
  platformOverrideSchema,
  type OrganizationAdminStatus,
} from '@templeos/validators';
import { domainError, err, forbidden, notFound, ok, type Result } from '../../shared';
import { createPlatformRepository } from './platform.repository';
import type { PlatformOrgSummary, PlatformOverview } from './platform.types';

interface OrgBillingRow {
  id: string;
  name: string;
  slug: string;
  country: string;
  orgStatus: string;
  createdAt: Date;
  plan: PlatformOrgSummary['plan'];
  subscriptionStatus: PlatformOrgSummary['subscriptionStatus'];
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}

function toSummary(row: OrgBillingRow): PlatformOrgSummary {
  const isTrialExpired =
    row.subscriptionStatus === 'trialing' &&
    row.trialEndsAt !== null &&
    row.trialEndsAt.getTime() < Date.now();
  const mrrUsd =
    row.subscriptionStatus === 'active' && row.plan ? (PLAN_CATALOG[row.plan].priceUsd ?? 0) : 0;

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
}

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
      const organizationSummaries = rows.map(toSummary);

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

    /** One org's detail for the /platform/orgs/[orgId] support screen. */
    async getOrgDetail(userId: string, organizationId: string): Promise<Result<PlatformOrgSummary>> {
      if (!(await repo.isPlatformAdmin(userId))) {
        return err(forbidden('Platform admin access required'));
      }
      const row = await repo.getOrganizationWithBilling(userId, organizationId);
      if (!row) return err(notFound('Organization'));
      return ok(toSummary(row));
    },

    /**
     * Manually override an org's plan/status/trial — the support tool for
     * comping a plan, un-sticking a past_due account after a payment issue
     * is resolved outside Stripe, or extending a trial.
     */
    async applySubscriptionOverride(
      actorUserId: string,
      organizationId: string,
      rawInput: unknown,
    ): Promise<Result<null>> {
      if (!(await repo.isPlatformAdmin(actorUserId))) {
        return err(forbidden('Platform admin access required'));
      }
      const parsed = platformOverrideSchema.safeParse(rawInput);
      if (!parsed.success) {
        return err(domainError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid input'));
      }
      if (!parsed.data.plan && !parsed.data.status && !parsed.data.extendTrialDays) {
        return err(domainError('VALIDATION', 'Choose at least one change to apply'));
      }
      await repo.applyOverride(organizationId, actorUserId, parsed.data);
      return ok(null);
    },

    /**
     * Suspends or reactivates an org. Suspension blocks that org's staff from
     * the admin dashboard (apps/admin/src/lib/session.ts#requireTenantContext)
     * — it deliberately does NOT take down the org's public donor-facing site,
     * which is a separate, more conservative boundary than a billing lapse.
     */
    async setOrganizationStatus(
      actorUserId: string,
      organizationId: string,
      status: OrganizationAdminStatus,
    ): Promise<Result<null>> {
      if (!(await repo.isPlatformAdmin(actorUserId))) {
        return err(forbidden('Platform admin access required'));
      }
      await repo.setOrganizationStatus(organizationId, actorUserId, status);
      return ok(null);
    },
  };
}

export type PlatformService = ReturnType<typeof createPlatformService>;
