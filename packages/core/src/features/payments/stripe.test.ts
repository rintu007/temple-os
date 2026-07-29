import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createStripeClient } from './stripe';

/** Mirrors Stripe's own header format so constructWebhookEvent can be exercised without a live key. */
function signedHeader(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('stripe webhook verification', () => {
  const secret = 'whsec_test_dummy';
  const client = createStripeClient({ secretKey: 'sk_test_dummy', webhookSecret: secret });

  it('accepts a correctly signed event and parses it', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
    const event = client.constructWebhookEvent(payload, signedHeader(payload, secret));
    expect(event?.type).toBe('checkout.session.completed');
  });

  it('rejects a tampered payload', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
    const header = signedHeader(payload, secret);
    const tampered = payload.replace('evt_1', 'evt_2');
    expect(client.constructWebhookEvent(tampered, header)).toBeNull();
  });

  it('rejects a signature produced with the wrong secret', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
    expect(client.constructWebhookEvent(payload, signedHeader(payload, 'whsec_wrong'))).toBeNull();
  });

  it('returns null when no webhook secret is configured', () => {
    const unconfigured = createStripeClient({ secretKey: 'sk_test_dummy', webhookSecret: null });
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
    expect(unconfigured.constructWebhookEvent(payload, signedHeader(payload, secret))).toBeNull();
  });
});
