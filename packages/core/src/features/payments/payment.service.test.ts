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
  paymentOrders,
  roles,
  users,
} from '@templeos/db';
import { systemContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createPaymentService } from './payment.service';
import { razorpayFromEnv } from './razorpay';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);
const hasRazorpay = razorpayFromEnv() !== null;

/**
 * Live suite: creates a REAL order against the Razorpay test-mode Orders API
 * (proves the configured keys work end to end), then confirms it with a
 * signature computed the same way Razorpay Checkout would hand it back to
 * us — HMAC-SHA256(order_id|payment_id, key_secret). That is exactly what
 * our confirm endpoint trusts in production; simulating it here validates
 * our own verification + recording logic without needing a real card charge.
 */
describe.skipIf(!hasDb || !hasRazorpay)('payments: order + confirm (live Razorpay + db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createPaymentService({ db });
  const razorpay = razorpayFromEnv()!;

  const run = `pay${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(paymentOrders).where(inArray(paymentOrders.organizationId, [orgId]));
      await admin.delete(donations).where(inArray(donations.organizationId, [orgId]));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, [orgId]));
      await admin
        .delete(donationCategories)
        .where(inArray(donationCategories.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up an INR organization', async () => {
    const a = await orgService.provisionOrganization(
      systemContext('payment test'),
      { name: 'Payment Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(a.ok).toBe(true);
    if (a.ok) orgId = a.value.id;
  });

  it('reports online checkout as available for INR', () => {
    expect(service.isOnlineCheckoutAvailable('INR')).toBe(true);
    expect(service.isOnlineCheckoutAvailable('BDT')).toBe(false);
  });

  it('rejects a malformed order request', async () => {
    const bad = await service.createDonationOrder({
      organizationId: orgId,
      organizationCurrency: 'INR',
      rawInput: { amount: -5, donorName: 'X' },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALIDATION');
  });

  it('rejects order creation for a BDT organization', async () => {
    const rejected = await service.createDonationOrder({
      organizationId: orgId,
      organizationCurrency: 'BDT',
      rawInput: { amount: 100, donorName: 'X' },
    });
    expect(rejected.ok).toBe(false);
  });

  let orderId = '';

  it('creates a real order against the Razorpay test API', async () => {
    const created = await service.createDonationOrder({
      organizationId: orgId,
      organizationCurrency: 'INR',
      rawInput: { amount: 501, donorName: 'Anita Roy', email: 'anita@example.com' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    orderId = created.value.orderId;
    expect(orderId).toMatch(/^order_/);
    expect(created.value.amountPaise).toBe(50_100);
    expect(created.value.keyId).toBe(razorpay.keyId);

    // Confirm the order genuinely exists on Razorpay's side.
    const fetched = await razorpay.fetchOrder(orderId);
    expect(fetched.status).toBe('created');
    expect(fetched.amount).toBe(50_100);
  });

  it('rejects confirmation with a forged signature', async () => {
    const forged = await service.confirmDonationOrder(orgId, {
      providerOrderId: orderId,
      providerPaymentId: 'pay_forged123',
      signature: 'deadbeef',
    });
    expect(forged.ok).toBe(false);
    if (!forged.ok) expect(forged.error.code).toBe('FORBIDDEN');
  });

  it('confirms with a validly-signed payment and records the donation', async () => {
    const paymentId = 'pay_simulated_001';
    // The same computation Razorpay Checkout performs client-side and hands
    // back to us — see razorpay.test.ts for the isolated unit test.
    const { createHmac } = await import('node:crypto');
    const validSignature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const confirmed = await service.confirmDonationOrder(orgId, {
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      signature: validSignature,
    });
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.value.amount).toBe('501.00');
      expect(confirmed.value.currency).toBe('INR');
      expect(confirmed.value.donorName).toBe('Anita Roy');
      expect(confirmed.value.receiptNumber).toMatch(/^\d{4}-\d{5}$/);
    }
  });

  it('confirming again is idempotent — no duplicate donation', async () => {
    const paymentId = 'pay_simulated_001';
    const { createHmac } = await import('node:crypto');
    const validSignature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const first = await service.confirmDonationOrder(orgId, {
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      signature: validSignature,
    });
    const second = await service.confirmDonationOrder(orgId, {
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      signature: validSignature,
    });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.receiptNumber).toBe(first.value.receiptNumber);
    }

    const rows = await admin
      .select()
      .from(donations)
      .where(inArray(donations.organizationId, [orgId]));
    expect(rows).toHaveLength(1);
  });

  it('confirming an unknown order fails cleanly', async () => {
    const missing = await service.confirmDonationOrder(orgId, {
      providerOrderId: 'order_does_not_exist',
      providerPaymentId: 'pay_x',
      signature: 'x',
    });
    expect(missing.ok).toBe(false);
  });
});
