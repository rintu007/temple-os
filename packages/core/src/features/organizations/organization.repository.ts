import { and, eq } from 'drizzle-orm';
import {
  auditLogs,
  domains,
  memberships,
  newId,
  organizations,
  roles,
  users,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { CreateOrganizationInput } from '@templeos/validators';
import type { SystemContext, TenantContext } from '../../shared';
import { SYSTEM_ROLES, type OwnerIdentity } from './organization.types';

/**
 * All reads/writes run under withTenantContext — the runtime role cannot see
 * tenant rows otherwise. Provisioning generates the organization id app-side
 * and opens the tenant context on it before the row exists; that is what lets
 * a brand-new organization be written under FORCE RLS.
 */
export function createOrganizationRepository(db: Db) {
  return {
    /** Subdomain availability via the public domains policy (hostnames are public data). */
    async isHostnameTaken(_ctx: SystemContext, hostname: string): Promise<boolean> {
      const [row] = await db
        .select({ id: domains.id })
        .from(domains)
        .where(eq(domains.hostname, hostname))
        .limit(1);
      return row !== undefined;
    },

    /**
     * Creates organization + owner user mirror + subdomain + system roles +
     * owner membership + audit entry atomically.
     */
    async provision(
      ctx: SystemContext,
      input: CreateOrganizationInput & {
        currency: 'INR' | 'BDT';
        hostname: string;
        owner: OwnerIdentity;
      },
    ) {
      const orgId = newId();
      return withTenantContext(
        db,
        { organizationId: orgId, userId: input.owner.userId },
        async (tx) => {
          await tx
            .insert(users)
            .values({
              id: input.owner.userId,
              email: input.owner.email,
              fullName: input.owner.fullName ?? null,
            })
            .onConflictDoUpdate({
              target: users.id,
              set: { email: input.owner.email, fullName: input.owner.fullName ?? null },
            });

          const [org] = await tx
            .insert(organizations)
            .values({
              id: orgId,
              name: input.name,
              slug: input.slug,
              country: input.country,
              currency: input.currency,
              status: 'active',
            })
            .returning();
          if (!org) throw new Error('organization insert returned no row');

          await tx.insert(domains).values({
            organizationId: orgId,
            hostname: input.hostname,
            type: 'subdomain',
            isPrimary: true,
            verifiedAt: new Date(),
          });

          const seededRoles = await tx
            .insert(roles)
            .values(
              SYSTEM_ROLES.map((r) => ({
                organizationId: orgId,
                key: r.key,
                name: r.name,
                isSystem: true,
              })),
            )
            .returning();

          const ownerRole = seededRoles.find((r) => r.key === 'owner');
          if (!ownerRole) throw new Error('owner role was not seeded');

          await tx.insert(memberships).values({
            organizationId: orgId,
            userId: input.owner.userId,
            roleId: ownerRole.id,
            status: 'active',
            templeIds: null,
          });

          await tx.insert(auditLogs).values({
            organizationId: orgId,
            actorUserId: ctx.actorUserId ?? input.owner.userId,
            action: 'organization.created',
            entityType: 'organization',
            entityId: orgId,
            after: { name: org.name, slug: org.slug, country: org.country },
          });

          return org;
        },
      );
    },

    /** Organizations the user belongs to, with their role — pre-org-context lookup. */
    async listForUser(userId: string) {
      return withTenantContext(db, { userId }, (tx) =>
        tx
          .select({
            organizationId: organizations.id,
            organizationName: organizations.name,
            organizationSlug: organizations.slug,
            organizationStatus: organizations.status,
            country: organizations.country,
            currency: organizations.currency,
            roleKey: roles.key,
            roleName: roles.name,
          })
          .from(memberships)
          .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
          .innerJoin(roles, eq(memberships.roleId, roles.id))
          .where(and(eq(memberships.userId, userId), eq(memberships.status, 'active')))
          .orderBy(organizations.createdAt),
      );
    },

    async findById(ctx: TenantContext) {
      return withTenantContext(
        db,
        { organizationId: ctx.organizationId, userId: ctx.userId },
        async (tx) => {
          const [org] = await tx
            .select()
            .from(organizations)
            .where(eq(organizations.id, ctx.organizationId))
            .limit(1);
          return org ?? null;
        },
      );
    },

    /** Public-site resolution: hostname → domain row (public policy) → organization. */
    async findByHostname(hostname: string) {
      const [domain] = await db
        .select({ organizationId: domains.organizationId })
        .from(domains)
        .where(eq(domains.hostname, hostname))
        .limit(1);
      if (!domain) return null;

      return withTenantContext(db, { organizationId: domain.organizationId }, async (tx) => {
        const [org] = await tx
          .select()
          .from(organizations)
          .where(eq(organizations.id, domain.organizationId))
          .limit(1);
        return org ?? null;
      });
    },
  };
}

export type OrganizationRepository = ReturnType<typeof createOrganizationRepository>;
