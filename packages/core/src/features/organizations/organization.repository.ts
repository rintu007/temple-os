import { eq } from 'drizzle-orm';
import type { Db } from '@templeos/db';
import { auditLogs, domains, memberships, organizations, roles, users } from '@templeos/db';
import type { CreateOrganizationInput } from '@templeos/validators';
import type { SystemContext } from '../../shared';
import { SYSTEM_ROLES } from './organization.types';

/**
 * Provisioning runs before a tenant exists, so this repository takes
 * SystemContext (not TenantContext) — the exception that proves the rule.
 * All tenant-scoped repositories take TenantContext as their first argument.
 */
export function createOrganizationRepository(db: Db) {
  return {
    async isSlugTaken(_ctx: SystemContext, slug: string): Promise<boolean> {
      const existing = await db.query.organizations.findFirst({
        where: eq(organizations.slug, slug),
        columns: { id: true },
      });
      return existing !== undefined;
    },

    async findOwnerUser(_ctx: SystemContext, userId: string) {
      return db.query.users.findFirst({ where: eq(users.id, userId) });
    },

    /**
     * Creates organization + subdomain + system roles + owner membership +
     * audit entry atomically.
     */
    async provision(
      ctx: SystemContext,
      input: CreateOrganizationInput & { currency: 'INR' | 'BDT'; hostname: string },
    ) {
      return db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organizations)
          .values({
            name: input.name,
            slug: input.slug,
            country: input.country,
            currency: input.currency,
            status: 'active',
          })
          .returning();
        if (!org) throw new Error('organization insert returned no row');

        await tx.insert(domains).values({
          organizationId: org.id,
          hostname: input.hostname,
          type: 'subdomain',
          isPrimary: true,
          verifiedAt: new Date(),
        });

        const seededRoles = await tx
          .insert(roles)
          .values(
            SYSTEM_ROLES.map((r) => ({
              organizationId: org.id,
              key: r.key,
              name: r.name,
              isSystem: true,
            })),
          )
          .returning();

        const ownerRole = seededRoles.find((r) => r.key === 'owner');
        if (!ownerRole) throw new Error('owner role was not seeded');

        await tx.insert(memberships).values({
          organizationId: org.id,
          userId: input.ownerUserId,
          roleId: ownerRole.id,
          status: 'active',
          templeIds: null,
        });

        await tx.insert(auditLogs).values({
          organizationId: org.id,
          actorUserId: ctx.actorUserId ?? input.ownerUserId,
          action: 'organization.created',
          entityType: 'organization',
          entityId: org.id,
          after: { name: org.name, slug: org.slug, country: org.country },
        });

        return org;
      });
    },
  };
}

export type OrganizationRepository = ReturnType<typeof createOrganizationRepository>;
