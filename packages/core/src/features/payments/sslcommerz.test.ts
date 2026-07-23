import { describe, expect, it } from 'vitest';
import { sslcommerzFromEnv } from './sslcommerz';

const hasSslcommerz = sslcommerzFromEnv() !== null;

describe('sslcommerzFromEnv', () => {
  it('is null-gated on credentials', () => {
    // With empty env vars the provider must be unavailable, never throwing.
    if (!process.env.SSLCOMMERZ_STORE_ID) {
      expect(sslcommerzFromEnv()).toBeNull();
    } else {
      expect(sslcommerzFromEnv()).not.toBeNull();
    }
  });
});

/**
 * Live sandbox suite — runs once SSLCOMMERZ_STORE_ID/PASSWORD (sandbox
 * credentials from developer.sslcommerz.com) land in .env. Creates a real
 * hosted-checkout session and checks the validator rejects a bogus val_id.
 */
describe.skipIf(!hasSslcommerz)('sslcommerz: session + validation (live sandbox)', () => {
  const client = sslcommerzFromEnv()!;

  it('creates a hosted checkout session', async () => {
    const session = await client.createSession({
      tranId: `test-${Date.now().toString(36)}`,
      amount: '500.00',
      customerName: 'Test Devotee',
      customerEmail: 'devotee@example.com',
      customerPhone: '01700000000',
      description: 'Temple donation',
      successUrl: 'https://example.com/api/payments/sslcommerz/callback',
      failUrl: 'https://example.com/api/payments/sslcommerz/callback?outcome=failed',
      cancelUrl: 'https://example.com/api/payments/sslcommerz/callback?outcome=cancelled',
    });
    expect(session.gatewayUrl).toMatch(/^https:\/\//);
  }, 30_000);

  it('rejects a bogus val_id', async () => {
    const validation = await client.validatePayment('bogus-val-id-000');
    expect(['VALID', 'VALIDATED']).not.toContain(validation.status);
  }, 30_000);
});
