import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createRazorpayClient } from './razorpay';

describe('razorpay signature verification', () => {
  const client = createRazorpayClient({ keyId: 'rzp_test_dummy', keySecret: 'test_secret' });

  it('accepts a correctly computed signature', () => {
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const signature = createHmac('sha256', 'test_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(client.verifyPaymentSignature({ orderId, paymentId, signature })).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const signature = createHmac('sha256', 'test_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(
      client.verifyPaymentSignature({ orderId, paymentId: 'pay_DIFFERENT', signature }),
    ).toBe(false);
  });

  it('rejects a signature produced with the wrong secret', () => {
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const wrongSignature = createHmac('sha256', 'not_the_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(
      client.verifyPaymentSignature({ orderId, paymentId, signature: wrongSignature }),
    ).toBe(false);
  });

  it('rejects garbage signatures without throwing', () => {
    expect(
      client.verifyPaymentSignature({ orderId: 'o', paymentId: 'p', signature: 'not-hex' }),
    ).toBe(false);
  });
});
