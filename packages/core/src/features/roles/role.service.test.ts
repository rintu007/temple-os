import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  donationCategories,
  donationCounters,
  donations,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDonationService } from '../donations/donation.service';
import { createExpenseService } from '../expenses/expense.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createRoleService } from './role.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('roles: custom roles with a hand-picked permission set (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const role$ = createRoleService({ db });
  const donation$ = createDonationService({ db });
  const expense$ = createExpenseService({ db });

  const run = `rol${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  const treasurer = { userId: randomUUID(), email: `trs-${run}@test.invalid`, fullName: 'Treasurer' };
  let orgId = '';
  let ownerCtx: TenantContext;
  let treasurerRoleId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, s));
      await admin.delete(donationCategories).where(inArray(donationCategories.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId, treasurer.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('lists the 5 pre-seeded system roles with their static permission counts', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('roles test'),
      { name: 'Roles Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ownerCtx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const list = await role$.listRoles(ownerCtx);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value).toHaveLength(5);
    expect(list.value.every((r) => r.isSystem)).toBe(true);
    const ownerRole = list.value.find((r) => r.key === 'owner');
    const viewerRole = list.value.find((r) => r.key === 'viewer');
    expect(ownerRole?.permissionCount).toBeGreaterThan(50);
    expect(viewerRole?.permissionCount).toBeLessThan(ownerRole!.permissionCount);
  });

  it('creates a custom "Treasurer" role with a hand-picked permission set', async () => {
    const created = await role$.createRole(ownerCtx, {
      name: 'Treasurer',
      permissionKeys: ['donations:read', 'donations:write', 'funds:read', 'accounts:read'],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const detail = await role$.getRole(ownerCtx, created.value.id);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    treasurerRoleId = detail.value.id;
    expect(detail.value.key).toBe('treasurer');
    expect(detail.value.isSystem).toBe(false);
    expect(detail.value.permissionKeys.sort()).toEqual(
      ['accounts:read', 'donations:read', 'donations:write', 'funds:read'].sort(),
    );
  });

  it('rejects a role with no permissions selected', async () => {
    const bad = await role$.createRole(ownerCtx, { name: 'Empty Role', permissionKeys: [] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALIDATION');
  });

  it("enforces exactly the treasurer's permission set end-to-end via authorize()", async () => {
    await admin
      .insert(users)
      .values({ id: treasurer.userId, email: treasurer.email, fullName: treasurer.fullName });
    await admin.insert(memberships).values({
      organizationId: orgId,
      userId: treasurer.userId,
      roleId: treasurerRoleId,
    });

    const grantedPermissions = await role$.resolvePermissions(orgId, 'treasurer');
    expect(grantedPermissions).not.toBeNull();
    const treasurerCtx: TenantContext = {
      organizationId: orgId,
      userId: treasurer.userId,
      roleKey: 'treasurer',
      templeIds: null,
      permissions: grantedPermissions ?? [],
    };

    // Granted: donations:write.
    const donation = await donation$.recordDonation(treasurerCtx, {
      donorName: 'Patron',
      amount: 500,
      method: 'cash',
      donatedOn: '2026-06-01',
    });
    expect(donation.ok).toBe(true);

    // Not granted: expenses:write — the treasurer role never checked that box.
    const expense = await expense$.recordExpense(treasurerCtx, {
      paidTo: 'Vendor',
      amount: 100,
      method: 'cash',
      spentOn: '2026-06-01',
    });
    expect(expense.ok).toBe(false);
    if (!expense.ok) expect(expense.error.code).toBe('FORBIDDEN');
  });

  it('updating the role changes what it can do', async () => {
    const updated = await role$.updateRole(ownerCtx, treasurerRoleId, {
      name: 'Treasurer',
      permissionKeys: ['donations:read', 'funds:read', 'accounts:read'], // donations:write removed
    });
    expect(updated.ok).toBe(true);

    const grantedPermissions = await role$.resolvePermissions(orgId, 'treasurer');
    const treasurerCtx: TenantContext = {
      organizationId: orgId,
      userId: treasurer.userId,
      roleKey: 'treasurer',
      templeIds: null,
      permissions: grantedPermissions ?? [],
    };
    const donation = await donation$.recordDonation(treasurerCtx, {
      donorName: 'Patron',
      amount: 500,
      method: 'cash',
      donatedOn: '2026-06-01',
    });
    expect(donation.ok).toBe(false);
    if (!donation.ok) expect(donation.error.code).toBe('FORBIDDEN');
  });

  it('blocks deleting a system role and a role still in use', async () => {
    const list = await role$.listRoles(ownerCtx);
    if (!list.ok) return;
    const systemRoleId = list.value.find((r) => r.key === 'owner')!.id;

    const systemDelete = await role$.deleteRole(ownerCtx, systemRoleId);
    expect(systemDelete.ok).toBe(false);

    const inUseDelete = await role$.deleteRole(ownerCtx, treasurerRoleId);
    expect(inUseDelete.ok).toBe(false);
    if (!inUseDelete.ok) expect(inUseDelete.error.code).toBe('CONFLICT');
  });

  it('deletes an unused custom role once its member is removed', async () => {
    await admin
      .delete(memberships)
      .where(inArray(memberships.userId, [treasurer.userId]));

    const deleted = await role$.deleteRole(ownerCtx, treasurerRoleId);
    expect(deleted.ok).toBe(true);
  });

  it('a viewer cannot manage roles', async () => {
    const viewer: TenantContext = { ...ownerCtx, roleKey: 'viewer' };
    const write = await role$.createRole(viewer, {
      name: 'Nope',
      permissionKeys: ['donations:read'],
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
