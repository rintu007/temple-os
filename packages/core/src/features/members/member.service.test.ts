import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  invitations,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createMemberService } from './member.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('members: invitations, acceptance, RBAC, isolation (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createMemberService({ db });

  const run = `mem${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  const invitee = {
    userId: randomUUID(),
    email: `staff-${run}@test.invalid`,
    fullName: 'New Staff',
  };
  const outsider = { userId: randomUUID(), email: `out-${run}@test.invalid`, fullName: 'Out' };
  let orgId = '';
  let otherOrgId = '';
  let inviteToken = '';

  const ctx = (roleKey = 'owner'): TenantContext => ({
    organizationId: orgId,
    userId: owner.userId,
    roleKey,
    templeIds: null,
  });

  afterAll(async () => {
    const orgIds = [orgId, otherOrgId].filter(Boolean);
    if (orgIds.length > 0) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, orgIds));
      await admin.delete(invitations).where(inArray(invitations.organizationId, orgIds));
      await admin.delete(memberships).where(inArray(memberships.organizationId, orgIds));
      await admin.delete(roles).where(inArray(roles.organizationId, orgIds));
      await admin.delete(domains).where(inArray(domains.organizationId, orgIds));
      await admin.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    await admin
      .delete(users)
      .where(inArray(users.id, [owner.userId, invitee.userId, outsider.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up organizations', async () => {
    const a = await orgService.provisionOrganization(
      systemContext('member test'),
      { name: 'Member Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(a.ok).toBe(true);
    if (a.ok) orgId = a.value.id;

    const b = await orgService.provisionOrganization(
      systemContext('member test'),
      { name: 'Other Org', slug: `${run}-other`, country: 'BD' },
      outsider,
    );
    expect(b.ok).toBe(true);
    if (b.ok) otherOrgId = b.value.id;
  });

  it('owner invites; staff role cannot', async () => {
    const denied = await service.createInvitation(ctx('staff'), {
      email: invitee.email,
      roleKey: 'staff',
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');

    const created = await service.createInvitation(ctx(), {
      email: invitee.email,
      roleKey: 'staff',
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      inviteToken = created.value.token;
      expect(created.value.status).toBe('pending');
    }

    const dup = await service.createInvitation(ctx(), { email: invitee.email, roleKey: 'admin' });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('CONFLICT');
  });

  it('token preview works without any membership', async () => {
    const preview = await service.previewInvitation(inviteToken);
    expect(preview?.state).toBe('valid');
    expect(preview?.organizationName).toBe('Member Org');
    expect(preview?.roleName).toBe('Staff');

    const unknown = await service.previewInvitation('not-a-real-token');
    expect(unknown).toBeNull();
  });

  it('acceptance requires the invited email', async () => {
    const wrongEmail = await service.acceptInvitation(inviteToken, {
      userId: randomUUID(),
      email: `wrong-${run}@test.invalid`,
    });
    expect(wrongEmail.ok).toBe(false);
    if (!wrongEmail.ok) expect(wrongEmail.error.code).toBe('FORBIDDEN');
  });

  it('accepting creates an active membership with the invited role', async () => {
    const accepted = await service.acceptInvitation(inviteToken, invitee);
    expect(accepted.ok).toBe(true);

    const membersList = await service.listMembers(ctx());
    expect(membersList.ok).toBe(true);
    if (membersList.ok) {
      expect(membersList.value).toHaveLength(2);
      const staff = membersList.value.find((m) => m.userId === invitee.userId);
      expect(staff?.roleKey).toBe('staff');
      expect(staff?.status).toBe('active');
    }

    const again = await service.acceptInvitation(inviteToken, invitee);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('CONFLICT');

    const pending = await service.listInvitations(ctx());
    if (pending.ok) expect(pending.value).toHaveLength(0);
  });

  it('revoked invitations cannot be accepted', async () => {
    const created = await service.createInvitation(ctx(), {
      email: `revoked-${run}@test.invalid`,
      roleKey: 'viewer',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const revoked = await service.revokeInvitation(ctx(), created.value.id);
    expect(revoked.ok).toBe(true);

    const accept = await service.acceptInvitation(created.value.token, {
      userId: randomUUID(),
      email: `revoked-${run}@test.invalid`,
    });
    expect(accept.ok).toBe(false);
    if (!accept.ok) expect(accept.error.code).toBe('CONFLICT');
  });

  it('other tenant sees no members or invitations of this org', async () => {
    const outsiderCtx: TenantContext = {
      organizationId: otherOrgId,
      userId: outsider.userId,
      roleKey: 'owner',
      templeIds: null,
    };
    const membersList = await service.listMembers(outsiderCtx);
    expect(membersList.ok).toBe(true);
    if (membersList.ok) {
      expect(membersList.value.every((m) => m.userId !== invitee.userId)).toBe(true);
      expect(membersList.value).toHaveLength(1); // only its own owner
    }
    const invitationsList = await service.listInvitations(outsiderCtx);
    if (invitationsList.ok) expect(invitationsList.value).toHaveLength(0);
  });
});
