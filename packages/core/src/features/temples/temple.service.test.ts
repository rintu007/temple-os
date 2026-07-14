import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  dailySchedules,
  domains,
  memberships,
  organizations,
  roles,
  temples,
  users,
  withTenantContext,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createTempleService } from './temple.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('temples: CRUD, schedule, authorization, isolation (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createTempleService({ db });

  const run = `t${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  const outsider = { userId: randomUUID(), email: `out-${run}@test.invalid`, fullName: 'Out' };
  let orgId = '';
  let otherOrgId = '';
  let templeId = '';
  let scheduleItemId = '';

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
      await admin.delete(dailySchedules).where(inArray(dailySchedules.organizationId, orgIds));
      await admin.delete(memberships).where(inArray(memberships.organizationId, orgIds));
      await admin.delete(roles).where(inArray(roles.organizationId, orgIds));
      await admin.delete(domains).where(inArray(domains.organizationId, orgIds));
      await admin.delete(temples).where(inArray(temples.organizationId, orgIds));
      await admin.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId, outsider.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up two organizations', async () => {
    const a = await orgService.provisionOrganization(
      systemContext('temple test'),
      { name: 'Temple Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(a.ok).toBe(true);
    if (a.ok) orgId = a.value.id;

    const b = await orgService.provisionOrganization(
      systemContext('temple test'),
      { name: 'Other Org', slug: `${run}-other`, country: 'BD' },
      outsider,
    );
    expect(b.ok).toBe(true);
    if (b.ok) otherOrgId = b.value.id;
  });

  it('creates and updates a temple, slug auto-generated', async () => {
    const created = await service.createTemple(ctx(), {
      name: 'Sri Radha Krishna Mandir',
      deity: 'Radha Krishna',
      city: 'Kolkata',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    templeId = created.value.id;
    expect(created.value.slug).toBe('sri-radha-krishna-mandir');

    const updated = await service.updateTemple(ctx(), templeId, {
      name: 'Sri Radha Krishna Mandir',
      deity: 'Radha Krishna',
      city: 'Kolkata',
      state: 'West Bengal',
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.value.state).toBe('West Bengal');
  });

  it('manages the daily schedule', async () => {
    const added = await service.addScheduleItem(ctx(), templeId, {
      title: 'Mangala Aarti',
      startTime: '05:30',
      endTime: '06:15',
    });
    expect(added.ok).toBe(true);
    if (added.ok) {
      scheduleItemId = added.value.id;
      expect(added.value.startTime).toBe('05:30:00');
    }

    const rejected = await service.addScheduleItem(ctx(), templeId, {
      title: 'Broken',
      startTime: '25:99',
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('VALIDATION');

    const list = await service.listSchedule(ctx(), templeId);
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.value).toHaveLength(1);
  });

  it('viewer role cannot write', async () => {
    const viewerCtx: TenantContext = { ...ctx(), roleKey: 'viewer' };
    const denied = await service.createTemple(viewerCtx, { name: 'Nope Temple' });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');

    const deniedSchedule = await service.addScheduleItem(viewerCtx, templeId, {
      title: 'Nope',
      startTime: '10:00',
    });
    expect(deniedSchedule.ok).toBe(false);
  });

  it('other tenant sees nothing of this temple', async () => {
    await withTenantContext(
      db,
      { organizationId: otherOrgId, userId: outsider.userId },
      async (tx) => {
        const t = await tx.select().from(temples).where(eq(temples.id, templeId));
        expect(t).toHaveLength(0);
        const s = await tx
          .select()
          .from(dailySchedules)
          .where(eq(dailySchedules.templeId, templeId));
        expect(s).toHaveLength(0);
      },
    );

    const outsiderCtx: TenantContext = {
      organizationId: otherOrgId,
      userId: outsider.userId,
      roleKey: 'owner',
      templeIds: null,
    };
    const crossGet = await service.getTemple(outsiderCtx, templeId);
    expect(crossGet.ok).toBe(false);
    if (!crossGet.ok) expect(crossGet.error.code).toBe('NOT_FOUND');
  });

  it('public site listing exposes temples with schedules', async () => {
    const publicTemples = await service.listPublicTemples(orgId);
    expect(publicTemples).toHaveLength(1);
    expect(publicTemples[0]?.name).toBe('Sri Radha Krishna Mandir');
    expect(publicTemples[0]?.schedule).toHaveLength(1);
    expect(publicTemples[0]?.schedule[0]?.title).toBe('Mangala Aarti');
  });

  it('removes schedule items', async () => {
    const removed = await service.removeScheduleItem(ctx(), scheduleItemId);
    expect(removed.ok).toBe(true);
    const list = await service.listSchedule(ctx(), templeId);
    if (list.ok) expect(list.value).toHaveLength(0);
  });
});
