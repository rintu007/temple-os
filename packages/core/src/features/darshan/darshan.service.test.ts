import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  darshanSlots,
  darshanTokens,
  domains,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createDarshanService } from './darshan.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

function isoOffset(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!hasDb)('darshan: capacity-limited token booking (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createDarshanService({ db });

  const run = `dar${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let slotId = '';

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(darshanTokens).where(inArray(darshanTokens.organizationId, [orgId]));
      await admin.delete(darshanSlots).where(inArray(darshanSlots.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('creates a slot with capacity 5', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('darshan test'),
      { name: 'Darshan Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await service.createSlot(ctx, {
      name: 'Morning Darshan',
      slotDate: isoOffset(3),
      startTime: '07:00',
      endTime: '09:00',
      capacity: 5,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      slotId = created.value.id;
      expect(created.value.remaining).toBe(5);
    }
  });

  it('books tokens with sequential numbers and decrements capacity', async () => {
    const a = await service.bookToken(orgId, {
      slotId,
      devoteeName: 'Family A',
      phone: '9000000001',
      partySize: 2,
    });
    const b = await service.bookToken(orgId, {
      slotId,
      devoteeName: 'Family B',
      phone: '9000000002',
      partySize: 2,
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok) expect(a.value.tokenNumber).toBe(1);
    if (b.ok) expect(b.value.tokenNumber).toBe(2);

    const slot = await service.getSlot(ctx, slotId);
    expect(slot.ok && slot.value.remaining).toBe(1);
  });

  it('rejects a booking that exceeds remaining capacity', async () => {
    const over = await service.bookToken(orgId, {
      slotId,
      devoteeName: 'Family C',
      phone: '9000000003',
      partySize: 2, // only 1 left
    });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe('CONFLICT');

    // A party of 1 still fits.
    const fits = await service.bookToken(orgId, {
      slotId,
      devoteeName: 'Solo D',
      phone: '9000000004',
      partySize: 1,
    });
    expect(fits.ok).toBe(true);
    if (fits.ok) expect(fits.value.tokenNumber).toBe(3);
  });

  it('cancelling a booked token frees its capacity', async () => {
    const tokens = await service.listTokens(ctx, slotId);
    expect(tokens.ok).toBe(true);
    const firstBooked = tokens.ok ? tokens.value.find((t) => t.status === 'booked') : undefined;
    expect(firstBooked).toBeTruthy();

    const cancelled = await service.cancelToken(ctx, firstBooked!.id);
    expect(cancelled.ok).toBe(true);

    // Freed 2 places → someone new can book them.
    const rebook = await service.bookToken(orgId, {
      slotId,
      devoteeName: 'Family E',
      phone: '9000000005',
      partySize: 2,
    });
    expect(rebook.ok).toBe(true);
  });

  it('a full slot is reported as such and hidden from the public list when closed', async () => {
    await service.setSlotActive(ctx, slotId, false);
    const publicSlots = await service.listPublicSlots(orgId);
    expect(publicSlots.find((s) => s.id === slotId)).toBeUndefined();

    const viewer: TenantContext = { ...ctx, roleKey: 'no_such_role' };
    const denied = await service.createSlot(viewer, {
      name: 'x',
      slotDate: isoOffset(1),
      startTime: '07:00',
      capacity: 1,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');
  });
});
