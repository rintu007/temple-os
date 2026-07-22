import { createHmac, randomUUID } from 'node:crypto';
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
  pujaBookings,
  pujaTypes,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { razorpayFromEnv } from '../payments/razorpay';
import { createPujaService } from './puja.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);
const hasRazorpay = razorpayFromEnv() !== null;

describe.skipIf(!hasDb || !hasRazorpay)('pujas: types, booking, confirm (live Razorpay + db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createPujaService({ db });
  const secret = process.env.RAZORPAY_KEY_SECRET!;

  const run = `puja${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let otherOrgId = '';
  let typeId = '';
  let orderId = '';

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
      await admin.delete(pujaBookings).where(inArray(pujaBookings.organizationId, orgIds));
      await admin.delete(pujaTypes).where(inArray(pujaTypes.organizationId, orgIds));
      await admin.delete(donations).where(inArray(donations.organizationId, orgIds));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, orgIds));
      await admin
        .delete(donationCategories)
        .where(inArray(donationCategories.organizationId, orgIds));
      await admin.delete(memberships).where(inArray(memberships.organizationId, orgIds));
      await admin.delete(roles).where(inArray(roles.organizationId, orgIds));
      await admin.delete(domains).where(inArray(domains.organizationId, orgIds));
      await admin.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up organizations', async () => {
    const a = await orgService.provisionOrganization(
      systemContext('puja test'),
      { name: 'Puja Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(a.ok).toBe(true);
    if (a.ok) orgId = a.value.id;

    const b = await orgService.provisionOrganization(
      systemContext('puja test'),
      { name: 'Other Org', slug: `${run}-other`, country: 'BD' },
      { userId: randomUUID(), email: `out-${run}@test.invalid` },
    );
    expect(b.ok).toBe(true);
    if (b.ok) otherOrgId = b.value.id;
  });

  it('manages puja types with org currency; viewer denied writes', async () => {
    const created = await service.createPujaType(ctx(), {
      name: 'Satyanarayan Puja',
      description: 'Full puja with prasad',
      price: 1100,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      typeId = created.value.id;
      expect(created.value.price).toBe('1100.00');
      expect(created.value.currency).toBe('INR');
    }

    const denied = await service.createPujaType({ ...ctx(), roleKey: 'viewer' }, {
      name: 'Nope',
      price: 100,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');

    const updated = await service.updatePujaType(ctx(), typeId, {
      name: 'Satyanarayan Puja',
      price: 1500,
      isActive: true,
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.value.price).toBe('1500.00');
  });

  it('lists only active types publicly', async () => {
    const draft = await service.createPujaType(ctx(), {
      name: 'Inactive Puja',
      price: 500,
      isActive: false,
    });
    expect(draft.ok).toBe(true);

    const publicTypes = await service.listPublicPujaTypes(orgId);
    expect(publicTypes.map((t) => t.name)).toContain('Satyanarayan Puja');
    expect(publicTypes.map((t) => t.name)).not.toContain('Inactive Puja');
  });

  it('creates a booking order against the real Razorpay API', async () => {
    const created = await service.createBookingOrder(orgId, 'INR', {
      pujaTypeId: typeId,
      devoteeName: 'Anita Roy',
      email: 'anita@example.com',
      preferredDate: '2026-09-01',
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      orderId = created.value.orderId;
      expect(orderId).toMatch(/^order_/);
      expect(created.value.amountPaise).toBe(150_000); // 1500.00 INR
      expect(created.value.pujaName).toBe('Satyanarayan Puja');
    }
  });

  it('rejects a forged signature', async () => {
    const forged = await service.confirmBooking(orgId, {
      providerOrderId: orderId,
      providerPaymentId: 'pay_x',
      signature: 'deadbeef',
    });
    expect(forged.ok).toBe(false);
    if (!forged.ok) expect(forged.error.code).toBe('FORBIDDEN');
  });

  it('confirms a valid payment — booking confirmed, donation + receipt recorded', async () => {
    const paymentId = 'pay_puja_001';
    const signature = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

    const confirmed = await service.confirmBooking(orgId, {
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      signature,
    });
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.value.pujaName).toBe('Satyanarayan Puja');
      expect(confirmed.value.amount).toBe('1500.00');
      expect(confirmed.value.receiptNumber).toMatch(/^\d{4}-\d{5}$/);
    }

    // Booking shows in the confirmed queue
    const bookings = await service.listBookings(ctx(), { status: 'confirmed' });
    expect(bookings.ok).toBe(true);
    if (bookings.ok) {
      expect(bookings.value.total).toBe(1);
      expect(bookings.value.items[0]?.devoteeName).toBe('Anita Roy');
    }
  });

  it('re-confirming is idempotent — one donation only', async () => {
    const paymentId = 'pay_puja_001';
    const signature = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    const again = await service.confirmBooking(orgId, {
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      signature,
    });
    expect(again.ok).toBe(true);

    const rows = await admin
      .select()
      .from(donations)
      .where(inArray(donations.organizationId, [orgId]));
    expect(rows).toHaveLength(1);
  });

  it('completes a booking', async () => {
    const bookings = await service.listBookings(ctx(), { status: 'confirmed' });
    const bookingId = bookings.ok ? bookings.value.items[0]?.id : undefined;
    expect(bookingId).toBeTruthy();
    const done = await service.markBookingCompleted(ctx(), bookingId!);
    expect(done.ok).toBe(true);

    const completed = await service.listBookings(ctx(), { status: 'completed' });
    if (completed.ok) expect(completed.value.total).toBe(1);
  });

  it('other tenant sees no types or bookings of this org', async () => {
    const outsiderCtx: TenantContext = {
      organizationId: otherOrgId,
      userId: randomUUID(),
      roleKey: 'owner',
      templeIds: null,
    };
    const types = await service.listPujaTypes(outsiderCtx);
    expect(types.ok).toBe(true);
    if (types.ok) expect(types.value).toHaveLength(0);

    const publicTypes = await service.listPublicPujaTypes(otherOrgId);
    expect(publicTypes).toHaveLength(0);

    const bookings = await service.listBookings(outsiderCtx, { status: 'all' });
    if (bookings.ok) expect(bookings.value.total).toBe(0);
  });
});
