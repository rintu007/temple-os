import type { Db } from '@templeos/db';
import { createInvitationSchema } from '@templeos/validators';
import {
  authorize,
  conflict,
  domainError,
  err,
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

    async revokeInvitation(ctx: TenantContext, invitationId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'organization:manage');
      if (!auth.ok) return auth;
      const revoked = await repo.revokeInvitation(ctx, invitationId);
      if (!revoked) return err(notFound('Invitation'));
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
