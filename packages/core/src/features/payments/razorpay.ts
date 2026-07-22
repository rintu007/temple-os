import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Minimal Razorpay client over their REST API — no SDK dependency.
 * Test mode and live mode differ only by the key pair.
 */

const API_BASE = 'https://api.razorpay.com/v1';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

export interface RazorpayOrder {
  id: string;
  /** Paise (integer) */
  amount: number;
  currency: string;
  status: 'created' | 'attempted' | 'paid';
  receipt: string | null;
  notes: Record<string, string>;
}

export interface CreateOrderParams {
  /** Paise (integer) */
  amountPaise: number;
  currency: 'INR';
  receipt?: string;
  notes?: Record<string, string>;
}

export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RazorpayError';
  }
}

export function createRazorpayClient({ keyId, keySecret }: RazorpayConfig) {
  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { description?: string };
      } | null;
      throw new RazorpayError(
        body?.error?.description ?? `Razorpay request failed (${res.status})`,
        res.status,
      );
    }
    return res.json() as Promise<T>;
  }

  return {
    keyId,

    async createOrder(params: CreateOrderParams): Promise<RazorpayOrder> {
      return request<RazorpayOrder>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          amount: params.amountPaise,
          currency: params.currency,
          receipt: params.receipt,
          notes: params.notes ?? {},
        }),
      });
    },

    async fetchOrder(orderId: string): Promise<RazorpayOrder> {
      return request<RazorpayOrder>(`/orders/${encodeURIComponent(orderId)}`);
    },

    /**
     * Checkout returns razorpay_signature = HMAC-SHA256(order_id + '|' +
     * payment_id, key_secret). A valid signature proves the payment happened
     * on this key pair for this order.
     */
    verifyPaymentSignature(params: {
      orderId: string;
      paymentId: string;
      signature: string;
    }): boolean {
      const expected = createHmac('sha256', keySecret)
        .update(`${params.orderId}|${params.paymentId}`)
        .digest('hex');
      const a = Buffer.from(expected, 'utf8');
      const b = Buffer.from(params.signature, 'utf8');
      return a.length === b.length && timingSafeEqual(a, b);
    },
  };
}

export type RazorpayClient = ReturnType<typeof createRazorpayClient>;

/** Builds a client from env, or null when payments are not configured. */
export function razorpayFromEnv(): RazorpayClient | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return createRazorpayClient({ keyId, keySecret });
}
