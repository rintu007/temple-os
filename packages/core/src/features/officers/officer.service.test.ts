import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  memberships,
  officeBearers,
  platformSubscriptions,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createOfficerService } from './officer.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('officers: trustee register with terms (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createOfficerService({ db });

  const run = `off${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let presidentId = '';

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(officeBearers).where(inArray(officeBearers.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(platformSubscriptions).where(inArray(platformSubscriptions.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and adds two office bearers', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('officer test'),
      { name: 'Officer Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const president = await service.createOfficer(ctx, {
      name: 'Anil Sharma',
      designation: 'President',
      body: 'Board of Trustees',
      termStartsOn: '2025-04-01',
    });
    expect(president.ok).toBe(true);
    if (president.ok) {
      presidentId = president.value.id;
      expect(president.value.isActive).toBe(true);
    }

    const secretary = await service.createOfficer(ctx, {
      name: 'Meera Nair',
      designation: 'Secretary',
    });
    expect(secretary.ok).toBe(true);
  });

  it('lists all and active-only', async () => {
    const all = await service.listOfficers(ctx, 'all');
    expect(all.ok).toBe(true);
    if (all.ok) expect(all.value).toHaveLength(2);

    const active = await service.listOfficers(ctx, 'active');
    expect(active.ok && active.value).toHaveLength(2);
  });

  it('ending a term stamps an end date and drops from active', async () => {
    const ended = await service.setOfficerActive(ctx, presidentId, false);
    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.value.isActive).toBe(false);
      expect(ended.value.termEndsOn).toBeTruthy();
    }

    const active = await service.listOfficers(ctx, 'active');
    expect(active.ok && active.value).toHaveLength(1);
  });

  it('updates a bearer and exports CSV', async () => {
    const updated = await service.updateOfficer(ctx, presidentId, {
      name: 'Anil Sharma',
      designation: 'Managing Trustee',
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.value.designation).toBe('Managing Trustee');

    const csv = await service.exportCsv(ctx);
    expect(csv.ok).toBe(true);
    if (csv.ok) {
      expect(csv.value).toContain('Name,Designation,Body,Phone,Email,Term Start,Term End,Status');
      expect(csv.value).toContain('Meera Nair');
    }
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await service.listOfficers(viewer, 'all');
    expect(read.ok).toBe(true);

    const write = await service.createOfficer(viewer, { name: 'X Y', designation: 'Trustee' });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
