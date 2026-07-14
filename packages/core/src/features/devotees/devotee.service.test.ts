import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  devotees,
  domains,
  families,
  memberships,
  organizations,
  roles,
  users,
  withTenantContext,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createDevoteeService } from './devotee.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('devotees: CRUD, search, families, isolation (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createDevoteeService({ db });

  const run = `d${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  const outsider = { userId: randomUUID(), email: `out-${run}@test.invalid`, fullName: 'Out' };
  let orgId = '';
  let otherOrgId = '';
  let devoteeId = '';

  const ctx = (): TenantContext => ({
    organizationId: orgId,
    userId: owner.userId,
    roleKey: 'owner',
    templeIds: null,
  });

  afterAll(async () => {
    const orgIds = [orgId, otherOrgId].filter(Boolean);
    if (orgIds.length > 0) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, orgIds));
      await admin.delete(devotees).where(inArray(devotees.organizationId, orgIds));
      await admin.delete(families).where(inArray(families.organizationId, orgIds));
      await admin.delete(memberships).where(inArray(memberships.organizationId, orgIds));
      await admin.delete(roles).where(inArray(roles.organizationId, orgIds));
      await admin.delete(domains).where(inArray(domains.organizationId, orgIds));
      await admin.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId, outsider.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up organizations', async () => {
    const a = await orgService.provisionOrganization(
      systemContext('devotee test'),
      { name: 'Devotee Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(a.ok).toBe(true);
    if (a.ok) orgId = a.value.id;

    const b = await orgService.provisionOrganization(
      systemContext('devotee test'),
      { name: 'Other Org', slug: `${run}-other`, country: 'BD' },
      outsider,
    );
    expect(b.ok).toBe(true);
    if (b.ok) otherOrgId = b.value.id;
  });

  it('creates devotees; same familyName reuses the family', async () => {
    const first = await service.createDevotee(ctx(), {
      fullName: 'Anita Chatterjee',
      phone: '+91 98765 43210',
      familyName: 'Chatterjee Family',
      city: 'Kolkata',
    });
    expect(first.ok).toBe(true);
    if (first.ok) devoteeId = first.value.id;

    const second = await service.createDevotee(ctx(), {
      fullName: 'Ravi Chatterjee',
      familyName: 'chatterjee family', // case-insensitive match
    });
    expect(second.ok).toBe(true);

    if (first.ok && second.ok) {
      expect(first.value.familyId).not.toBeNull();
      expect(second.value.familyId).toBe(first.value.familyId);
    }
  });

  it('lists with search and pagination', async () => {
    const all = await service.listDevotees(ctx(), {});
    expect(all.ok).toBe(true);
    if (all.ok) expect(all.value.total).toBe(2);

    const searched = await service.listDevotees(ctx(), { search: 'anita' });
    expect(searched.ok).toBe(true);
    if (searched.ok) {
      expect(searched.value.total).toBe(1);
      expect(searched.value.items[0]?.fullName).toBe('Anita Chatterjee');
    }

    const paged = await service.listDevotees(ctx(), { page: 2, pageSize: 1 });
    expect(paged.ok).toBe(true);
    if (paged.ok) {
      expect(paged.value.items).toHaveLength(1);
      expect(paged.value.total).toBe(2);
    }
  });

  it('updates and archives', async () => {
    const updated = await service.updateDevotee(ctx(), devoteeId, {
      fullName: 'Anita Chatterjee',
      phone: '+91 90000 00000',
      familyName: 'Chatterjee Family',
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.value.phone).toBe('+91 90000 00000');

    const archived = await service.archiveDevotee(ctx(), devoteeId);
    expect(archived.ok).toBe(true);

    const listAfter = await service.listDevotees(ctx(), {});
    if (listAfter.ok) expect(listAfter.value.total).toBe(1); // archived hidden from active list
  });

  it('viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx(), roleKey: 'viewer' };
    const read = await service.listDevotees(viewer, {});
    expect(read.ok).toBe(true);

    const write = await service.createDevotee(viewer, { fullName: 'Nope' });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });

  it('other tenant sees nothing', async () => {
    const outsiderCtx: TenantContext = {
      organizationId: otherOrgId,
      userId: outsider.userId,
      roleKey: 'owner',
      templeIds: null,
    };
    const list = await service.listDevotees(outsiderCtx, {});
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.value.total).toBe(0);

    const get = await service.getDevotee(outsiderCtx, devoteeId);
    expect(get.ok).toBe(false);

    await withTenantContext(
      db,
      { organizationId: otherOrgId, userId: outsider.userId },
      async (tx) => {
        const rows = await tx.select().from(devotees).where(eq(devotees.organizationId, orgId));
        expect(rows).toHaveLength(0);
      },
    );
  });
});
