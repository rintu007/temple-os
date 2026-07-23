import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  memberships,
  organizations,
  priests,
  pujaBookings,
  pujaTypes,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createPujaRepository } from './puja.repository';
import { createPujaService } from './puja.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('sevas: priest roster + scheduling (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createPujaService({ db });
  const repo = createPujaRepository(db);

  const run = `seva${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let priestId = '';
  let bookingId = '';

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(pujaBookings).where(inArray(pujaBookings.organizationId, [orgId]));
      await admin.delete(pujaTypes).where(inArray(pujaTypes.organizationId, [orgId]));
      await admin.delete(priests).where(inArray(priests.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up an organization with a paid booking', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('seva test'),
      { name: 'Seva Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const type = await service.createPujaType(ctx, {
      name: 'Satyanarayan Puja',
      description: '',
      price: 1100,
      isActive: true,
    });
    expect(type.ok).toBe(true);
    if (!type.ok) return;

    const booking = await repo.createPendingBooking(orgId, {
      pujaTypeId: type.value.id,
      pujaName: 'Satyanarayan Puja',
      devoteeName: 'Test Devotee',
      email: null,
      phone: null,
      amount: '1100.00',
      currency: 'INR',
      preferredDate: null,
      note: null,
      providerOrderId: `order_${run}`,
    });
    bookingId = booking.id;
    // Simulate the paid state staff would see in the queue
    await admin
      .update(pujaBookings)
      .set({ status: 'confirmed' })
      .where(inArray(pujaBookings.id, [bookingId]));
  });

  it('adds a priest to the roster', async () => {
    const created = await service.createPriest(ctx, {
      name: 'Pandit Ramesh Shastri',
      phone: '+91 98000 00000',
      specialty: 'Satyanarayan katha',
      isActive: true,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      priestId = created.value.id;
      expect(created.value.name).toBe('Pandit Ramesh Shastri');
    }
  });

  it('rejects an invalid priest and viewer writes', async () => {
    const bad = await service.createPriest(ctx, { name: 'X' });
    expect(bad.ok).toBe(false);
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const forbidden = await service.createPriest(viewer, { name: 'Someone Valid' });
    expect(forbidden.ok).toBe(false);
  });

  it('assigns priest + slot to the booking', async () => {
    const assigned = await service.assignSeva(ctx, bookingId, {
      priestId,
      scheduledOn: '2026-08-01',
      scheduledTime: '08:30',
    });
    expect(assigned.ok).toBe(true);
  });

  it('rejects assignment to an unknown priest', async () => {
    const bad = await service.assignSeva(ctx, bookingId, {
      priestId: randomUUID(),
      scheduledOn: '2026-08-01',
      scheduledTime: '09:00',
    });
    expect(bad.ok).toBe(false);
  });

  it('the day view lists the seva with priest name', async () => {
    const day = await service.listSevaDay(ctx, '2026-08-01');
    expect(day.ok).toBe(true);
    if (day.ok) {
      expect(day.value).toHaveLength(1);
      expect(day.value[0]?.pujaName).toBe('Satyanarayan Puja');
      expect(day.value[0]?.priestName).toBe('Pandit Ramesh Shastri');
      expect(day.value[0]?.scheduledTime?.slice(0, 5)).toBe('08:30');
    }
    const otherDay = await service.listSevaDay(ctx, '2026-08-02');
    expect(otherDay.ok).toBe(true);
    if (otherDay.ok) expect(otherDay.value).toHaveLength(0);
  });

  it('clearing the assignment removes it from the day view', async () => {
    const cleared = await service.assignSeva(ctx, bookingId, {
      priestId: '',
      scheduledOn: '',
      scheduledTime: '',
    });
    expect(cleared.ok).toBe(true);
    const day = await service.listSevaDay(ctx, '2026-08-01');
    expect(day.ok).toBe(true);
    if (day.ok) expect(day.value).toHaveLength(0);
  });

  it('deactivating a priest keeps history but flags the roster', async () => {
    const off = await service.setPriestActive(ctx, priestId, false);
    expect(off.ok).toBe(true);
    const list = await service.listPriests(ctx);
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.value.find((p) => p.id === priestId)?.isActive).toBe(false);
  });
});
