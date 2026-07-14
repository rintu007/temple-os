import type { Db } from '@templeos/db';
import { CURRENCY_BY_COUNTRY, createOrganizationSchema } from '@templeos/validators';
import {
  conflict,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type SystemContext,
  type TenantContext,
} from '../../shared';
import { createOrganizationRepository } from './organization.repository';
import type {
  MembershipSummary,
  OrganizationSummary,
  OwnerIdentity,
  TenantSite,
} from './organization.types';

export interface OrganizationServiceDeps {
  db: Db;
  /** e.g. 'templeos.com' in production, 'localhost' in dev */
  rootDomain: string;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === '23505';
}

export function createOrganizationService({ db, rootDomain }: OrganizationServiceDeps) {
  const repo = createOrganizationRepository(db);

  const toSummary = (org: {
    id: string;
    name: string;
    slug: string;
    country: 'IN' | 'BD';
    currency: 'INR' | 'BDT';
    status: 'pending' | 'active' | 'suspended';
  }): OrganizationSummary => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    country: org.country,
    currency: org.currency,
    status: org.status,
  });

  return {
    async isSlugAvailable(ctx: SystemContext, slug: string): Promise<boolean> {
      return !(await repo.isHostnameTaken(ctx, `${slug}.${rootDomain}`));
    },

    /**
     * Signup flow: creates the organization with its subdomain, seeded system
     * roles, and the owner's membership. Owner identity must come from the
     * verified session.
     */
    async provisionOrganization(
      ctx: SystemContext,
      rawInput: unknown,
      owner: OwnerIdentity,
    ): Promise<Result<OrganizationSummary>> {
      const parsed = createOrganizationSchema.safeParse(rawInput);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return err(
          domainError('VALIDATION', first?.message ?? 'Invalid organization details', {
            issues: parsed.error.flatten().fieldErrors,
          }),
        );
      }
      const input = parsed.data;
      const hostname = `${input.slug}.${rootDomain}`;

      if (await repo.isHostnameTaken(ctx, hostname)) {
        return err(conflict('This subdomain is already taken', { field: 'slug' }));
      }

      try {
        const org = await repo.provision(ctx, {
          ...input,
          currency: CURRENCY_BY_COUNTRY[input.country],
          hostname,
          owner,
        });
        return ok(toSummary(org));
      } catch (e) {
        // Unique index is the real guard; the pre-check above only improves UX.
        if (isUniqueViolation(e)) {
          return err(conflict('This subdomain is already taken', { field: 'slug' }));
        }
        throw e;
      }
    },

    /** Organizations the user belongs to — used to resolve the active tenant after login. */
    async listUserMemberships(userId: string): Promise<MembershipSummary[]> {
      return repo.listForUser(userId);
    },

    async getOrganization(ctx: TenantContext): Promise<Result<OrganizationSummary>> {
      const org = await repo.findById(ctx);
      if (!org) return err(notFound('Organization'));
      return ok(toSummary(org));
    },

    /** Public sites: hostname → tenant. Returns null for unknown or inactive tenants. */
    async resolveSiteByHostname(hostname: string): Promise<TenantSite | null> {
      const org = await repo.findByHostname(hostname.toLowerCase());
      if (!org || org.status !== 'active' || org.deletedAt !== null) return null;
      return {
        organizationId: org.id,
        name: org.name,
        slug: org.slug,
        country: org.country,
        currency: org.currency,
      };
    },
  };
}

export type OrganizationService = ReturnType<typeof createOrganizationService>;
