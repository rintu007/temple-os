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
  paymentOrders,
  roles,
  users,
} from '@templeos/db';
import { systemContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createPaymentService } from './payment.service';
import { razorpayFromEnv } from './razorpay';
import { createWebhookService, verifyWebhookSignature } from './webhook.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);
const hasRazorpay = razorpayFromEnv() !== null;

const WEBHOOK_SECRET = 'whsec_test_local_only';

function signedEvent(body: object, secret = WEBHOOK_SECRET) {
  const rawBody = JSON.stringify(body);
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
  return { rawBody, signature };
}

describe('verifyWebhookSignature', () => {
  it('accepts the matching HMAC and rejects everything else', () => {
    const { rawBody, signature } = signedEvent({ event: 'payment.captured' });
    expect(verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET)).toBe(true);
    expect(verifyWebhookSignature(rawBody, signature, 'other-secret')).toBe(false);
    expect(verifyWebhookSignature(`${rawBody} `, signature, WEBHOOK_SECRET)).toBe(false);
    expect(verifyWebhookSignature(rawBody, 'deadbeef', WEBHOOK_SECRET)).toBe(false);
  });
});

/**
 * Live suite: creates a REAL Razorpay test-mode order through the payment
 * service (which stores organizationId in the order notes), then delivers the
 * `payment.captured` webhook exactly as Razorpay would — raw JSON body signed
 * with the webhook secret — and expects a recorded donation. Redelivery must
 * be a no-op (alreadyPaid) so receipt emails are never duplicated.
 */
describe.skipIf(!hasDb || !hasRazorpay)('webhook: payment.captured dispatch (live)', () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const paymentService = createPaymentService({ db });
  const webhookServiceInstance = createWebhookService({ db });

  const run = `wh${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let orderId = '';

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

  it('sets up an INR organization with a pending donation order', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('webhook test'),
      { name: 'Webhook Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;

    const created = await paymentService.createDonationOrder({
      organizationId: orgId,
      organizationCurrency: 'INR',
      rawInput: { amount: 251, donorName: 'Webhook Devotee', email: 'devotee@example.com' },
    });
    expect(created.ok).toBe(true);
    if (created.ok) orderId = created.value.orderId;
  });

  it('rejects a tampered body', async () => {
    const { rawBody, signature } = signedEvent({ event: 'payment.captured' });
    const result = await webhookServiceInstance.handleEvent(`${rawBody} `, signature);
    expect(result.outcome).toBe('invalid_signature');
  });

  it('ignores events other than payment.captured', async () => {
    const { rawBody, signature } = signedEvent({ event: 'payment.failed' });
    const result = await webhookServiceInstance.handleEvent(rawBody, signature);
    expect(result.outcome).toBe('ignored');
  });

  it('records the donation from a signed payment.captured event', async () => {
    const { rawBody, signature } = signedEvent({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_wh_${run}`,
            order_id: orderId,
            notes: { organizationId: orgId },
          },
        },
      },
    });
    const result = await webhookServiceInstance.handleEvent(rawBody, signature);
    expect(result.outcome).toBe('confirmed');
    if (result.outcome === 'confirmed') {
      expect(result.kind).toBe('donation');
      expect(result.alreadyPaid).toBe(false);
      expect(result.organizationName).toBe('Webhook Org');
      expect(result.email).toBe('devotee@example.com');
      expect(result.amount).toBe('251.00');
      expect(result.receiptNumber).toMatch(/^\d{4}-\d{5}$/);
    }
  });

  it('redelivery is a no-op flagged alreadyPaid — one donation row total', async () => {
    const { rawBody, signature } = signedEvent({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_wh_${run}`,
            order_id: orderId,
            notes: { organizationId: orgId },
          },
        },
      },
    });
    const result = await webhookServiceInstance.handleEvent(rawBody, signature);
    expect(result.outcome).toBe('confirmed');
    if (result.outcome === 'confirmed') expect(result.alreadyPaid).toBe(true);

    const rows = await admin
      .select()
      .from(donations)
      .where(inArray(donations.organizationId, [orgId]));
    expect(rows).toHaveLength(1);
  });

  it('ignores an unknown order without erroring', async () => {
    const { rawBody, signature } = signedEvent({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_unknown',
            order_id: 'order_does_not_exist',
            notes: { organizationId: orgId },
          },
        },
      },
    });
    const result = await webhookServiceInstance.handleEvent(rawBody, signature);
    expect(result.outcome).toBe('ignored');
  });
});
