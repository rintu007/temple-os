import type { Db } from '@templeos/db';
import {
  CURRENCY_BY_COUNTRY,
  createOrganizationSchema,
  type CreateOrganizationInput,
} from '@templeos/validators';
import { conflict, domainError, err, ok, type Result, type SystemContext } from '../../shared';
import { createOrganizationRepository } from './organization.repository';
import type { OrganizationSummary } from './organization.types';

export interface OrganizationServiceDeps {
  db: Db;
  /** e.g. 'templeos.com' in production, 'localhost' in dev */
  rootDomain: string;
}

export function createOrganizationService({ db, rootDomain }: OrganizationServiceDeps) {
  const repo = createOrganizationRepository(db);

  return {
    async isSlugAvailable(ctx: SystemContext, slug: string): Promise<boolean> {
      return !(await repo.isSlugTaken(ctx, slug));
    },

    /**
     * Signup flow: creates the organization with its subdomain, seeded system
     * roles, and the owner's membership.
     */
    async provisionOrganization(
      ctx: SystemContext,
      rawInput: CreateOrganizationInput,
    ): Promise<Result<OrganizationSummary>> {
      const parsed = createOrganizationSchema.safeParse(rawInput);
      if (!parsed.success) {
        return err(
          domainError('VALIDATION', 'Invalid organization details', {
            issues: parsed.error.flatten().fieldErrors,
          }),
        );
      }
      const input = parsed.data;

      const owner = await repo.findOwnerUser(ctx, input.ownerUserId);
      if (!owner) {
        return err(domainError('VALIDATION', 'Owner user does not exist'));
      }

      if (await repo.isSlugTaken(ctx, input.slug)) {
        return err(conflict('This subdomain is already taken', { field: 'slug' }));
      }

      const org = await repo.provision(ctx, {
        ...input,
        currency: CURRENCY_BY_COUNTRY[input.country],
        hostname: `${input.slug}.${rootDomain}`,
      });

      return ok({
        id: org.id,
        name: org.name,
        slug: org.slug,
        country: org.country,
        currency: org.currency,
        status: org.status,
      });
    },
  };
}

export type OrganizationService = ReturnType<typeof createOrganizationService>;
