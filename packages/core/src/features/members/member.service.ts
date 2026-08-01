import type { Db } from '@templeos/db';
import { createInvitationSchema } from '@templeos/validators';
import {
  authorize,
  conflict,
  domainError,
  err,
  forbidden,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createMemberRepository, type AcceptorIdentity } from './member.repository';
import type { InvitationPreview, InvitationSummary, MemberSummary } from './member.types';

export function createMemberService({ db }: { db: Db }) {
  const repo = createMemberRepository(db);

  return {
    async listMembers(ctx: TenantContext): Promise<Result<MemberSummary[]>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;
      return ok(await repo.listMembers(ctx));
    },

    async listInvitations(ctx: TenantContext): Promise<Result<InvitationSummary[]>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;
      return ok(await repo.listInvitations(ctx));
    },

    async createInvitation(
      ctx: TenantContext,
      rawInput: unknown,
    ): Promise<Result<InvitationSummary>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;

      const parsed = createInvitationSchema.safeParse(rawInput);
      if (!parsed.success) {
        return err(
          domainError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid input'),
        );
      }

      const result = await repo.createInvitation(ctx, parsed.data);
      if (result.kind === 'already_member') {
        return err(conflict('This person is already a member of your organization'));
      }
      if (result.kind === 'already_invited') {
        return err(conflict('There is already a pending invitation for this email'));
      }
      if (result.kind === 'seat_limit_reached') {
        return err(
          conflict('Your plan has reached its staff seat limit — upgrade to invite more people'),
        );
      }
      if (result.kind === 'role_not_found') {
        return err(notFound('Role'));
      }
      const inv = result.invitation;
      return ok({
        id: inv.id,
        email: inv.email,
        roleKey: inv.roleKey,
        roleName: inv.roleName,
        token: inv.token,
        status: inv.status,
        expiresAt: inv.expiresAt,
      });
    },

    /** Rotates the token and extends the expiry — lets a lost/expired invite be re-sent without revoking and recreating it. */
    async resendInvitation(ctx: TenantContext, invitationId: string): Promise<Result<InvitationSummary>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;

      const inv = await repo.resendInvitation(ctx, invitationId);
      if (!inv) return err(notFound('Invitation'));
      return ok({
        id: inv.id,
        email: inv.email,
        roleKey: inv.roleKey,
        roleName: inv.roleName,
        token: inv.token,
        status: inv.status,
        expiresAt: inv.expiresAt,
      });
    },

    async revokeInvitation(ctx: TenantContext, invitationId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;
      const revoked = await repo.revokeInvitation(ctx, invitationId);
      if (!revoked) return err(notFound('Invitation'));
      return ok(null);
    },

    /**
     * Disables the membership (soft — memberships.status: 'invited'|'active'
     * |'disabled', so history/audit references stay intact). Self-service is
     * deliberately disallowed: ask another owner/admin to remove you, which
     * sidesteps every self-lockout edge case rather than trying to detect them.
     */
    async removeMember(ctx: TenantContext, membershipId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;

      const result = await repo.removeMember(ctx, membershipId);
      if (result.kind === 'not_found') return err(notFound('Member'));
      if (result.kind === 'self') {
        return err(
          domainError('VALIDATION', "You can't remove your own access — ask another owner or admin."),
        );
      }
      if (result.kind === 'last_owner') {
        return err(conflict('An organization must have at least one owner — promote someone else first.'));
      }
      return ok(null);
    },

    /** Ownership transfer isn't available through this action — see the 'owner' guard below. */
    async updateMemberRole(
      ctx: TenantContext,
      membershipId: string,
      roleKey: string,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;
      if (roleKey === 'owner') {
        return err(domainError('VALIDATION', 'Ownership transfer is not available here.'));
      }

      const result = await repo.updateMemberRole(ctx, membershipId, roleKey);
      if (result.kind === 'not_found') return err(notFound('Member'));
      if (result.kind === 'role_not_found') return err(notFound('Role'));
      if (result.kind === 'self') {
        return err(
          domainError('VALIDATION', "You can't change your own role — ask another owner or admin."),
        );
      }
      if (result.kind === 'last_owner') {
        return err(conflict('An organization must have at least one owner — promote someone else first.'));
      }
      return ok(null);
    },

    /**
     * Owner-only hand-off: promotes another active member to owner and
     * demotes the caller to admin. Gated on ctx.roleKey directly rather than
     * a permission, because 'organization:manage' alone doesn't distinguish
     * owner from admin (both have it) — and an admin must never be able to
     * grant themselves ownership through this action.
     */
    async transferOwnership(ctx: TenantContext, membershipId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;
      if (ctx.roleKey !== 'owner') {
        return err(forbidden('Only the current owner can transfer ownership'));
      }

      const result = await repo.transferOwnership(ctx, membershipId);
      if (result.kind === 'not_found') return err(notFound('Member'));
      if (result.kind === 'self') {
        return err(domainError('VALIDATION', 'You are already the owner.'));
      }
      if (result.kind === 'already_owner') {
        return err(domainError('VALIDATION', 'This member is already an owner.'));
      }
      return ok(null);
    },

    /** Public-ish: what the /invite/[token] page shows. Null = token unknown. */
    async previewInvitation(token: string): Promise<InvitationPreview | null> {
      const invitation = await repo.findByToken(token);
      if (!invitation) return null;
      const { organizationName, roleName } = await repo.previewContext(
        invitation.organizationId,
        invitation.roleId,
      );
      const state =
        invitation.status === 'pending'
          ? invitation.expiresAt.getTime() < Date.now()
            ? 'expired'
            : 'valid'
          : invitation.status;
      return { organizationName, email: invitation.email, roleName, state };
    },

    /** Accepts an invitation for the signed-in user. Email must match the invite. */
    async acceptInvitation(token: string, who: AcceptorIdentity): Promise<Result<null>> {
      const invitation = await repo.findByToken(token);
      if (!invitation) return err(notFound('Invitation'));
      if (invitation.status === 'revoked') {
        return err(conflict('This invitation was revoked'));
      }
      if (invitation.status === 'accepted') {
        return err(conflict('This invitation was already accepted'));
      }
      if (invitation.expiresAt.getTime() < Date.now()) {
        return err(conflict('This invitation has expired — ask for a new link'));
      }
      if (invitation.email.toLowerCase() !== who.email.toLowerCase()) {
        return err(
          domainError(
            'FORBIDDEN',
            `This invitation is for ${invitation.email}. Sign in with that email to accept it.`,
          ),
        );
      }

      await repo.accept(invitation.id, invitation.organizationId, invitation.roleId, who);
      return ok(null);
    },
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
