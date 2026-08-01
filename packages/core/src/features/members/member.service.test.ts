import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  invitations,
  memberships,
  platformSubscriptions,
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
  const secondOwner = { userId: randomUUID(), email: `owner2-${run}@test.invalid` };
  const newOwner = { userId: randomUUID(), email: `newowner-${run}@test.invalid` };
  const seatOwner = { userId: randomUUID(), email: `seatowner-${run}@test.invalid`, fullName: 'Seat Owner' };
  let orgId = '';
  let otherOrgId = '';
  let seatOrgId = '';
  let inviteToken = '';
  let inviteeMembershipId = '';

  const ctx = (roleKey = 'owner'): TenantContext => ({
    organizationId: orgId,
    userId: owner.userId,
    roleKey,
    templeIds: null,
  });

  afterAll(async () => {
    const orgIds = [orgId, otherOrgId, seatOrgId].filter(Boolean);
    if (orgIds.length > 0) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, orgIds));
      await admin.delete(invitations).where(inArray(invitations.organizationId, orgIds));
      await admin.delete(memberships).where(inArray(memberships.organizationId, orgIds));
      await admin.delete(roles).where(inArray(roles.organizationId, orgIds));
      await admin.delete(domains).where(inArray(domains.organizationId, orgIds));
      await admin.delete(platformSubscriptions).where(inArray(platformSubscriptions.organizationId, orgIds));
      await admin.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    await admin.delete(users).where(
      inArray(users.id, [
        owner.userId,
        invitee.userId,
        outsider.userId,
        secondOwner.userId,
        newOwner.userId,
        seatOwner.userId,
      ]),
    );
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
    if (a.ok) {
      orgId = a.value.id;
      // This suite exercises RBAC across many invitations, unrelated to seat
      // limits (which get their own dedicated test below) — put it on a plan
      // with unlimited seats so the invite-heavy flow below isn't blocked.
      await admin
        .update(platformSubscriptions)
        .set({ plan: 'growth' })
        .where(eq(platformSubscriptions.organizationId, orgId));
    }

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
      if (staff) inviteeMembershipId = staff.membershipId;
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

  it('resending an invitation rotates its token so the old link stops working', async () => {
    const created = await service.createInvitation(ctx(), {
      email: `resend-${run}@test.invalid`,
      roleKey: 'viewer',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const oldToken = created.value.token;

    const denied = await service.resendInvitation(ctx('staff'), created.value.id);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');

    const resent = await service.resendInvitation(ctx(), created.value.id);
    expect(resent.ok).toBe(true);
    if (resent.ok) {
      expect(resent.value.token).not.toBe(oldToken);
      expect(resent.value.email).toBe(created.value.email);
    }

    const acceptOld = await service.acceptInvitation(oldToken, {
      userId: randomUUID(),
      email: `resend-${run}@test.invalid`,
    });
    expect(acceptOld.ok).toBe(false);
    if (!acceptOld.ok) expect(acceptOld.error.code).toBe('NOT_FOUND');

    const missing = await service.resendInvitation(ctx(), randomUUID());
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');

    await service.revokeInvitation(ctx(), created.value.id);
  });

  it('a non-manager cannot change roles or remove members', async () => {
    const denied1 = await service.updateMemberRole(ctx('staff'), inviteeMembershipId, 'manager');
    expect(denied1.ok).toBe(false);
    if (!denied1.ok) expect(denied1.error.code).toBe('FORBIDDEN');

    const denied2 = await service.removeMember(ctx('staff'), inviteeMembershipId);
    expect(denied2.ok).toBe(false);
    if (!denied2.ok) expect(denied2.error.code).toBe('FORBIDDEN');
  });

  it('an owner can change another member’s role, but not their own, and not to owner', async () => {
    const changed = await service.updateMemberRole(ctx(), inviteeMembershipId, 'manager');
    expect(changed.ok).toBe(true);

    const members = await service.listMembers(ctx());
    if (members.ok) {
      expect(members.value.find((m) => m.userId === invitee.userId)?.roleKey).toBe('manager');
    }

    const [ownerMembership] = members.ok
      ? members.value.filter((m) => m.userId === owner.userId)
      : [];
    expect(ownerMembership).toBeDefined();

    const self = await service.updateMemberRole(ctx(), ownerMembership!.membershipId, 'manager');
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.error.code).toBe('VALIDATION');

    const toOwner = await service.updateMemberRole(ctx(), inviteeMembershipId, 'owner');
    expect(toOwner.ok).toBe(false);
    if (!toOwner.ok) expect(toOwner.error.code).toBe('VALIDATION');
  });

  it('an organization must always keep at least one owner', async () => {
    const [ownerRole] = await admin
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.organizationId, orgId), eq(roles.key, 'owner')));
    expect(ownerRole).toBeDefined();

    // A second owner, seeded directly — updateMemberRole itself never grants 'owner'.
    await admin.insert(users).values({ id: secondOwner.userId, email: secondOwner.email });
    const [secondOwnerMembership] = await admin
      .insert(memberships)
      .values({
        organizationId: orgId,
        userId: secondOwner.userId,
        roleId: ownerRole!.id,
        status: 'active',
        templeIds: null,
      })
      .returning();

    const beforeDemote = await service.listMembers(ctx());
    const originalOwnerMembershipId = beforeDemote.ok
      ? beforeDemote.value.find((m) => m.userId === owner.userId)!.membershipId
      : '';

    // An actor who isn't either owner (so the 'self' guard never fires) demoting the
    // ORIGINAL owner is fine while two owners exist...
    const demoteFirst = await service.updateMemberRole(
      { organizationId: orgId, userId: invitee.userId, roleKey: 'owner', templeIds: null },
      originalOwnerMembershipId,
      'manager',
    );
    expect(demoteFirst.ok).toBe(true);

    // ...but demoting/removing the one remaining owner (the seeded second owner) must fail.
    const lastOwnerDemote = await service.updateMemberRole(
      { organizationId: orgId, userId: invitee.userId, roleKey: 'owner', templeIds: null },
      secondOwnerMembership!.id,
      'manager',
    );
    expect(lastOwnerDemote.ok).toBe(false);
    if (!lastOwnerDemote.ok) expect(lastOwnerDemote.error.code).toBe('CONFLICT');

    const lastOwnerRemove = await service.removeMember(
      { organizationId: orgId, userId: invitee.userId, roleKey: 'owner', templeIds: null },
      secondOwnerMembership!.id,
    );
    expect(lastOwnerRemove.ok).toBe(false);
    if (!lastOwnerRemove.ok) expect(lastOwnerRemove.error.code).toBe('CONFLICT');

    // Restore: put the original owner back in the owner role for later assertions/cleanup.
    await admin
      .update(memberships)
      .set({ roleId: ownerRole!.id })
      .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, owner.userId)));
  });

  it('removing a member disables their membership rather than deleting it', async () => {
    const removed = await service.removeMember(ctx(), inviteeMembershipId);
    expect(removed.ok).toBe(true);

    const members = await service.listMembers(ctx());
    if (members.ok) {
      expect(members.value.some((m) => m.userId === invitee.userId)).toBe(false);
    }

    const [row] = await admin
      .select({ status: memberships.status })
      .from(memberships)
      .where(eq(memberships.id, inviteeMembershipId));
    expect(row?.status).toBe('disabled');
  });

  it('rejects acting on your own membership and on a membership that does not exist', async () => {
    const members = await service.listMembers(ctx());
    const ownMembershipId = members.ok
      ? members.value.find((m) => m.userId === owner.userId)?.membershipId
      : undefined;
    expect(ownMembershipId).toBeDefined();

    const selfRemove = await service.removeMember(ctx(), ownMembershipId!);
    expect(selfRemove.ok).toBe(false);
    if (!selfRemove.ok) expect(selfRemove.error.code).toBe('VALIDATION');

    const notFound = await service.removeMember(ctx(), randomUUID());
    expect(notFound.ok).toBe(false);
    if (!notFound.ok) expect(notFound.error.code).toBe('NOT_FOUND');
  });

  it('transfers ownership: promotes the target, demotes the acting owner to admin', async () => {
    const [staffRole] = await admin
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.organizationId, orgId), eq(roles.key, 'staff')));
    expect(staffRole).toBeDefined();

    await admin.insert(users).values({ id: newOwner.userId, email: newOwner.email });
    const [newMembership] = await admin
      .insert(memberships)
      .values({
        organizationId: orgId,
        userId: newOwner.userId,
        roleId: staffRole!.id,
        status: 'active',
        templeIds: null,
      })
      .returning();

    const [ownMembership] = await admin
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, owner.userId)));
    const [secondOwnerMembership] = await admin
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, secondOwner.userId)));

    // Not the owner (organization:manage alone isn't enough — 'admin' has it too).
    const denied = await service.transferOwnership(ctx('admin'), newMembership!.id);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');

    // Transferring to yourself, or to an unknown membership, is rejected.
    const self = await service.transferOwnership(ctx(), ownMembership!.id);
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.error.code).toBe('VALIDATION');

    const missing = await service.transferOwnership(ctx(), randomUUID());
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');

    // secondOwner (seeded earlier, still an owner) — transferring to an existing owner is a no-op error.
    const already = await service.transferOwnership(ctx(), secondOwnerMembership!.id);
    expect(already.ok).toBe(false);
    if (!already.ok) expect(already.error.code).toBe('VALIDATION');

    const transferred = await service.transferOwnership(ctx(), newMembership!.id);
    expect(transferred.ok).toBe(true);

    const [newOwnerRow] = await admin
      .select({ roleKey: roles.key })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(eq(memberships.id, newMembership!.id));
    expect(newOwnerRow?.roleKey).toBe('owner');

    const [demotedOwnerRow] = await admin
      .select({ roleKey: roles.key })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(eq(memberships.id, ownMembership!.id));
    expect(demotedOwnerRow?.roleKey).toBe('admin');
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

  it('enforces the plan seat limit (trial defaults to 2 seats: owner + 1 invite)', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('member test'),
      { name: 'Seat Org', slug: `${run}-seat`, country: 'IN' },
      seatOwner,
    );
    expect(provisioned.ok).toBe(true);
    if (!provisioned.ok) return;
    seatOrgId = provisioned.value.id;

    const seatCtx: TenantContext = {
      organizationId: seatOrgId,
      userId: seatOwner.userId,
      roleKey: 'owner',
      templeIds: null,
    };

    // Owner alone already fills 1 of 2 trial seats; this invite fills the 2nd.
    const first = await service.createInvitation(seatCtx, {
      email: `seat1-${run}@test.invalid`,
      roleKey: 'staff',
    });
    expect(first.ok).toBe(true);

    // A 3rd distinct email is refused — the org is at its seat limit.
    const second = await service.createInvitation(seatCtx, {
      email: `seat2-${run}@test.invalid`,
      roleKey: 'staff',
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe('CONFLICT');
      expect(second.error.message).toMatch(/seat limit/i);
    }
  });
});
