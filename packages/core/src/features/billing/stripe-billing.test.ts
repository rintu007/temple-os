import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createStripeBillingClient } from './stripe-billing';

/** Mirrors Stripe's own header format so constructWebhookEvent can be exercised without a live key. */
function signedHeader(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('stripe billing webhook verification', () => {
  const secret = 'whsec_billing_test_dummy';
  const client = createStripeBillingClient({ secretKey: 'sk_test_dummy', webhookSecret: secret });

  it('accepts a correctly signed subscription event and parses it', () => {
    const payload = JSON.stringify({
      id: 'evt_1',
      type: 'customer.subscription.updated',
      data: { object: { status: 'active' } },
    });
    const event = client.constructWebhookEvent(payload, signedHeader(payload, secret));
    expect(event?.type).toBe('customer.subscription.updated');
  });

  it('rejects a tampered payload', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: {} } });
    const header = signedHeader(payload, secret);
    const tampered = payload.replace('evt_1', 'evt_2');
    expect(client.constructWebhookEvent(tampered, header)).toBeNull();
  });

  it('rejects a signature produced with the wrong secret', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: {} } });
    expect(client.constructWebhookEvent(payload, signedHeader(payload, 'whsec_wrong'))).toBeNull();
  });

  it('returns null when no webhook secret is configured', () => {
    const unconfigured = createStripeBillingClient({ secretKey: 'sk_test_dummy', webhookSecret: null });
    const payload = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: {} } });
    expect(unconfigured.constructWebhookEvent(payload, signedHeader(payload, secret))).toBeNull();
  });
});
