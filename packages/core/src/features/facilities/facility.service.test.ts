import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  facilities,
  facilityBookings,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createFacilityService } from './facility.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('facilities: booking requests + double-booking guard (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createFacilityService({ db });

  const run = `fac${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let facilityId = '';
  const DATE = '2026-12-20';

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(facilityBookings).where(inArray(facilityBookings.organizationId, [orgId]));
      await admin.delete(facilities).where(inArray(facilities.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up an organization and a facility', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('facility test'),
      { name: 'Facility Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await service.createFacility(ctx, {
      name: 'Kalyana Mandapam',
      description: 'Air-conditioned wedding hall.',
      capacity: 500,
      rentAmount: 25000,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      facilityId = created.value.id;
      expect(created.value.rentAmount).toBe('25000.00');
      expect(created.value.capacity).toBe(500);
    }
  });

  it('validation rejects zero rent and viewer writes', async () => {
    const bad = await service.createFacility(ctx, { name: 'Bad Hall', rentAmount: 0 });
    expect(bad.ok).toBe(false);
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const forbidden = await service.createFacility(viewer, { name: 'Nope Hall', rentAmount: 100 });
    expect(forbidden.ok).toBe(false);
  });

  let firstBookingId = '';
  let secondBookingId = '';

  it('public list shows active facility; two devotees request the same date', async () => {
    const publicList = await service.listPublicFacilities(orgId);
    expect(publicList).toHaveLength(1);
    expect(publicList[0]?.name).toBe('Kalyana Mandapam');

    const a = await service.requestBooking(orgId, {
      facilityId,
      bookerName: 'Family A',
      phone: '9000000001',
      eventDate: DATE,
      purpose: 'Wedding',
    });
    const b = await service.requestBooking(orgId, {
      facilityId,
      bookerName: 'Family B',
      phone: '9000000002',
      eventDate: DATE,
      purpose: 'Reception',
    });
    expect(a.ok && b.ok).toBe(true);

    const requested = await service.listBookings(ctx, 'requested');
    expect(requested.ok).toBe(true);
    if (requested.ok) {
      expect(requested.value).toHaveLength(2);
      firstBookingId = requested.value[0]!.id;
      secondBookingId = requested.value[1]!.id;
    }
  });

  it('confirming the first holds the slot; confirming the second is blocked', async () => {
    const first = await service.confirmBooking(ctx, firstBookingId);
    expect(first.ok).toBe(true);

    const second = await service.confirmBooking(ctx, secondBookingId);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('CONFLICT');
  });

  it('a new request for the now-confirmed date is rejected up front', async () => {
    const late = await service.requestBooking(orgId, {
      facilityId,
      bookerName: 'Family C',
      phone: '9000000003',
      eventDate: DATE,
    });
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.error.code).toBe('CONFLICT');
  });

  it('cancelling the confirmed booking frees the date to confirm the other', async () => {
    const cancelled = await service.cancelBooking(ctx, firstBookingId);
    expect(cancelled.ok).toBe(true);

    const nowConfirm = await service.confirmBooking(ctx, secondBookingId);
    expect(nowConfirm.ok).toBe(true);
  });

  it('requesting an inactive facility fails', async () => {
    await service.setFacilityActive(ctx, facilityId, false);
    const req = await service.requestBooking(orgId, {
      facilityId,
      bookerName: 'Family D',
      phone: '9000000004',
      eventDate: '2027-01-01',
    });
    expect(req.ok).toBe(false);
    expect(await service.listPublicFacilities(orgId)).toHaveLength(0);
  });
});
