import { randomBytes } from 'node:crypto';
import { and, asc, count, desc, eq, gt, sql } from 'drizzle-orm';
import {
  auditLogs,
  invitations,
  memberships,
  newId,
  organizations,
  planCatalog,
  platformSubscriptions,
  roles,
  users,
  withInviteToken,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { TenantContext } from '../../shared';

const INVITE_TTL_MS = 7 * 24 * 3_600_000;

export interface AcceptorIdentity {
  userId: string;
  email: string;
  fullName?: string | null;
}

export function createMemberRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async listMembers(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select({
            membershipId: memberships.id,
            userId: users.id,
            fullName: users.fullName,
            email: users.email,
            roleKey: roles.key,
            roleName: roles.name,
            status: memberships.status,
          })
          .from(memberships)
          .innerJoin(users, eq(memberships.userId, users.id))
          .innerJoin(roles, eq(memberships.roleId, roles.id))
          .where(
            and(eq(memberships.organizationId, ctx.organizationId), eq(memberships.status, 'active')),
          )
          .orderBy(asc(memberships.createdAt)),
      );
    },

    async listInvitations(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select({
            id: invitations.id,
            email: invitations.email,
            roleKey: roles.key,
            roleName: roles.name,
            token: invitations.token,
            status: invitations.status,
            expiresAt: invitations.expiresAt,
          })
          .from(invitations)
          .innerJoin(roles, eq(invitations.roleId, roles.id))
          .where(
            and(
              eq(invitations.organizationId, ctx.organizationId),
              eq(invitations.status, 'pending'),
            ),
          )
          .orderBy(desc(invitations.createdAt)),
      );
    },

    /** Returns 'already_member' | 'already_invited' | 'seat_limit_reached' | the created invitation. */
    async createInvitation(ctx: TenantContext, input: { email: string; roleKey: string }) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [existingMember] = await tx
          .select({ id: memberships.id })
          .from(memberships)
          .innerJoin(users, eq(memberships.userId, users.id))
          .where(
            and(
              eq(memberships.organizationId, ctx.organizationId),
              sql`lower(${users.email}) = ${input.email}`,
            ),
          )
          .limit(1);
        if (existingMember) return { kind: 'already_member' as const };

        const [pending] = await tx
          .select({ id: invitations.id })
          .from(invitations)
          .where(
            and(
              eq(invitations.organizationId, ctx.organizationId),
              eq(invitations.status, 'pending'),
              sql`lower(${invitations.email}) = ${input.email}`,
            ),
          )
          .limit(1);
        if (pending) return { kind: 'already_invited' as const };

        const [sub] = await tx
          .select({ plan: platformSubscriptions.plan })
          .from(platformSubscriptions)
          .where(eq(platformSubscriptions.organizationId, ctx.organizationId))
          .limit(1);
        if (sub) {
          const [plan] = await tx
            .select({ seatLimit: planCatalog.seatLimit })
            .from(planCatalog)
            .where(eq(planCatalog.key, sub.plan))
            .limit(1);
          if (plan?.seatLimit != null) {
            const [activeRow] = await tx
              .select({ value: count() })
              .from(memberships)
              .where(
                and(
                  eq(memberships.organizationId, ctx.organizationId),
                  eq(memberships.status, 'active'),
                ),
              );
            const [pendingRow] = await tx
              .select({ value: count() })
              .from(invitations)
              .where(
                and(
                  eq(invitations.organizationId, ctx.organizationId),
                  eq(invitations.status, 'pending'),
                  gt(invitations.expiresAt, new Date()),
                ),
              );
            const seatsUsed = (activeRow?.value ?? 0) + (pendingRow?.value ?? 0);
            if (seatsUsed >= plan.seatLimit) return { kind: 'seat_limit_reached' as const };
          }
        }

        const [role] = await tx
          .select({ id: roles.id, name: roles.name })
          .from(roles)
          .where(and(eq(roles.organizationId, ctx.organizationId), eq(roles.key, input.roleKey)))
          .limit(1);
        if (!role) return { kind: 'role_not_found' as const };

        const token = randomBytes(24).toString('base64url');
        const [invitation] = await tx
          .insert(invitations)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            email: input.email,
            roleId: role.id,
            token,
            expiresAt: new Date(Date.now() + INVITE_TTL_MS),
            invitedByUserId: ctx.userId,
          })
          .returning();
        if (!invitation) throw new Error('invitation insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'invitation.created',
          entityType: 'invitation',
          entityId: invitation.id,
          after: { email: input.email, role: input.roleKey },
        });

        return {
          kind: 'ok' as const,
          invitation: { ...invitation, roleKey: input.roleKey, roleName: role.name },
        };
      });
    },

    /** Returns 'not_found' | 'self' | 'last_owner' | the disabled membership. */
    async removeMember(ctx: TenantContext, membershipId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [target] = await tx
          .select({
            id: memberships.id,
            userId: memberships.userId,
            roleKey: roles.key,
            email: users.email,
          })
          .from(memberships)
          .innerJoin(roles, eq(memberships.roleId, roles.id))
          .innerJoin(users, eq(memberships.userId, users.id))
          .where(
            and(
              eq(memberships.id, membershipId),
              eq(memberships.organizationId, ctx.organizationId),
              eq(memberships.status, 'active'),
            ),
          )
          .limit(1);
        if (!target) return { kind: 'not_found' as const };
        if (target.userId === ctx.userId) return { kind: 'self' as const };

        if (target.roleKey === 'owner') {
          const [row] = await tx
            .select({ value: count() })
            .from(memberships)
            .innerJoin(roles, eq(memberships.roleId, roles.id))
            .where(
              and(
                eq(memberships.organizationId, ctx.organizationId),
                eq(memberships.status, 'active'),
                eq(roles.key, 'owner'),
              ),
            );
          if ((row?.value ?? 0) <= 1) return { kind: 'last_owner' as const };
        }

        await tx
          .update(memberships)
          .set({ status: 'disabled' })
          .where(eq(memberships.id, membershipId));

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'member.removed',
          entityType: 'membership',
          entityId: membershipId,
          before: { email: target.email, role: target.roleKey },
        });

        return { kind: 'ok' as const };
      });
    },

    /** Returns 'not_found' | 'self' | 'last_owner' | 'role_not_found' | 'ok'. */
    async updateMemberRole(ctx: TenantContext, membershipId: string, roleKey: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [target] = await tx
          .select({ id: memberships.id, userId: memberships.userId, currentRoleKey: roles.key })
          .from(memberships)
          .innerJoin(roles, eq(memberships.roleId, roles.id))
          .where(
            and(
              eq(memberships.id, membershipId),
              eq(memberships.organizationId, ctx.organizationId),
              eq(memberships.status, 'active'),
            ),
          )
          .limit(1);
        if (!target) return { kind: 'not_found' as const };
        if (target.userId === ctx.userId) return { kind: 'self' as const };

        if (target.currentRoleKey === 'owner') {
          const [row] = await tx
            .select({ value: count() })
            .from(memberships)
            .innerJoin(roles, eq(memberships.roleId, roles.id))
            .where(
              and(
                eq(memberships.organizationId, ctx.organizationId),
                eq(memberships.status, 'active'),
                eq(roles.key, 'owner'),
              ),
            );
          if ((row?.value ?? 0) <= 1) return { kind: 'last_owner' as const };
        }

        const [newRole] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(and(eq(roles.organizationId, ctx.organizationId), eq(roles.key, roleKey)))
          .limit(1);
        if (!newRole) return { kind: 'role_not_found' as const };

        await tx
          .update(memberships)
          .set({ roleId: newRole.id })
          .where(eq(memberships.id, membershipId));

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'member.role_changed',
          entityType: 'membership',
          entityId: membershipId,
          before: { role: target.currentRoleKey },
          after: { role: roleKey },
        });

        return { kind: 'ok' as const };
      });
    },

    /** Issues a fresh token + expiry for a still-pending invitation. Null if not found/pending. */
    async resendInvitation(ctx: TenantContext, invitationId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const token = randomBytes(24).toString('base64url');
        const [invitation] = await tx
          .update(invitations)
          .set({ token, expiresAt: new Date(Date.now() + INVITE_TTL_MS) })
          .where(and(eq(invitations.id, invitationId), eq(invitations.status, 'pending')))
          .returning();
        if (!invitation) return null;

        const [role] = await tx
          .select({ key: roles.key, name: roles.name })
          .from(roles)
          .where(eq(roles.id, invitation.roleId))
          .limit(1);

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'invitation.resent',
          entityType: 'invitation',
          entityId: invitationId,
          after: { email: invitation.email },
        });

        return { ...invitation, roleKey: role?.key ?? '', roleName: role?.name ?? 'Member' };
      });
    },

    /**
     * Hands ownership to another active member and demotes the acting owner
     * to admin in the same transaction — the org is never ownerless, even
     * for an instant. Returns 'not_found' | 'self' | 'already_owner' | 'ok'.
     */
    async transferOwnership(ctx: TenantContext, membershipId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [target] = await tx
          .select({
            id: memberships.id,
            userId: memberships.userId,
            roleKey: roles.key,
            email: users.email,
          })
          .from(memberships)
          .innerJoin(roles, eq(memberships.roleId, roles.id))
          .innerJoin(users, eq(memberships.userId, users.id))
          .where(
            and(
              eq(memberships.id, membershipId),
              eq(memberships.organizationId, ctx.organizationId),
              eq(memberships.status, 'active'),
            ),
          )
          .limit(1);
        if (!target) return { kind: 'not_found' as const };
        if (target.userId === ctx.userId) return { kind: 'self' as const };
        if (target.roleKey === 'owner') return { kind: 'already_owner' as const };

        const [ownerRole] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(and(eq(roles.organizationId, ctx.organizationId), eq(roles.key, 'owner')))
          .limit(1);
        const [adminRole] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(and(eq(roles.organizationId, ctx.organizationId), eq(roles.key, 'admin')))
          .limit(1);
        if (!ownerRole || !adminRole) return { kind: 'not_found' as const };

        await tx
          .update(memberships)
          .set({ roleId: ownerRole.id })
          .where(eq(memberships.id, membershipId));
        await tx
          .update(memberships)
          .set({ roleId: adminRole.id })
          .where(
            and(
              eq(memberships.organizationId, ctx.organizationId),
              eq(memberships.userId, ctx.userId),
            ),
          );

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'member.ownership_transferred',
          entityType: 'membership',
          entityId: membershipId,
          before: { ownerUserId: ctx.userId },
          after: { ownerUserId: target.userId, email: target.email },
        });

        return { kind: 'ok' as const };
      });
    },

    async revokeInvitation(ctx: TenantContext, invitationId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [revoked] = await tx
          .update(invitations)
          .set({ status: 'revoked' })
          .where(and(eq(invitations.id, invitationId), eq(invitations.status, 'pending')))
          .returning();
        if (!revoked) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'invitation.revoked',
          entityType: 'invitation',
          entityId: invitationId,
          before: { email: revoked.email },
        });
        return revoked;
      });
    },

    /** Token-scoped read: works with no membership at all. */
    async findByToken(token: string) {
      return withInviteToken(db, token, async (tx) => {
        const [invitation] = await tx
          .select()
          .from(invitations)
          .where(eq(invitations.token, token))
          .limit(1);
        return invitation ?? null;
      });
    },

    /** Org name + role name for the invite preview page (server-resolved org context). */
    async previewContext(organizationId: string, roleId: string) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [org] = await tx
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1);
        const [role] = await tx
          .select({ name: roles.name })
          .from(roles)
          .where(eq(roles.id, roleId))
          .limit(1);
        return { organizationName: org?.name ?? 'a temple', roleName: role?.name ?? 'Member' };
      });
    },

    /** Accept: mirror user, create membership, mark invitation accepted — atomically. */
    async accept(invitationId: string, organizationId: string, roleId: string, who: AcceptorIdentity) {
      return withTenantContext(
        db,
        { organizationId, userId: who.userId },
        async (tx) => {
          await tx
            .insert(users)
            .values({ id: who.userId, email: who.email, fullName: who.fullName ?? null })
            .onConflictDoUpdate({
              target: users.id,
              set: { email: who.email, fullName: who.fullName ?? null },
            });

          const [existing] = await tx
            .select({ id: memberships.id })
            .from(memberships)
            .where(
              and(
                eq(memberships.organizationId, organizationId),
                eq(memberships.userId, who.userId),
              ),
            )
            .limit(1);

          if (!existing) {
            await tx.insert(memberships).values({
              organizationId,
              userId: who.userId,
              roleId,
              status: 'active',
              templeIds: null,
            });
          }

          await tx
            .update(invitations)
            .set({ status: 'accepted', acceptedByUserId: who.userId })
            .where(eq(invitations.id, invitationId));

          await tx.insert(auditLogs).values({
            organizationId,
            actorUserId: who.userId,
            action: 'invitation.accepted',
            entityType: 'invitation',
            entityId: invitationId,
            after: { email: who.email },
          });
        },
      );
    },
  };
}

export type MemberRepository = ReturnType<typeof createMemberRepository>;
