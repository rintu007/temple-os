/**
 * Minimal SSLCommerz client over their REST API — no SDK dependency.
 * BDT payments for Bangladesh. Unlike Razorpay's in-page modal, SSLCommerz is
 * a REDIRECT gateway: we create a session, send the devotee to GatewayPageURL,
 * and they return to our callback with a val_id that we verify server-side
 * against the validation API before recording anything.
 */

export interface SslcommerzConfig {
  storeId: string;
  storePassword: string;
  sandbox: boolean;
}

export interface CreateSessionParams {
  /** Our payment_orders.providerOrderId — unique per transaction. */
  tranId: string;
  /** Decimal string, e.g. "500.00" */
  amount: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  description: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
}

export interface SslcommerzValidation {
  status: string; // VALID | VALIDATED | INVALID_TRANSACTION | ...
  tranId: string;
  amount: string;
  currency: string;
  bankTranId: string;
  cardType: string;
}

export class SslcommerzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SslcommerzError';
  }
}

export function createSslcommerzClient({ storeId, storePassword, sandbox }: SslcommerzConfig) {
  const base = sandbox ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com';

  return {
    sandbox,

    /** Creates a hosted-checkout session; returns the page to redirect to. */
    async createSession(params: CreateSessionParams): Promise<{ gatewayUrl: string }> {
      const body = new URLSearchParams({
        store_id: storeId,
        store_passwd: storePassword,
        total_amount: params.amount,
        currency: 'BDT',
        tran_id: params.tranId,
        success_url: params.successUrl,
        fail_url: params.failUrl,
        cancel_url: params.cancelUrl,
        product_name: params.description,
        product_category: 'Donation',
        product_profile: 'non-physical-goods',
        shipping_method: 'NO',
        cus_name: params.customerName,
        cus_email: params.customerEmail ?? 'no-reply@templeos.app',
        cus_phone: params.customerPhone ?? 'N/A',
        cus_add1: 'N/A',
        cus_city: 'N/A',
        cus_country: 'Bangladesh',
      });

      const res = await fetch(`${base}/gwprocess/v4/api.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!res.ok) throw new SslcommerzError(`Session request failed (${res.status})`);
      const json = (await res.json()) as {
        status?: string;
        GatewayPageURL?: string;
        failedreason?: string;
      };
      if (json.status !== 'SUCCESS' || !json.GatewayPageURL) {
        throw new SslcommerzError(json.failedreason ?? 'Could not create payment session');
      }
      return { gatewayUrl: json.GatewayPageURL };
    },

    /**
     * Server-side validation of a returned payment. NEVER trust the callback
     * body alone — only a VALID/VALIDATED answer from this API, with matching
     * amount and currency, proves the money moved.
     */
    async validatePayment(valId: string): Promise<SslcommerzValidation> {
      const qs = new URLSearchParams({
        val_id: valId,
        store_id: storeId,
        store_passwd: storePassword,
        format: 'json',
      });
      const res = await fetch(`${base}/validator/api/validationserverAPI.php?${qs}`);
      if (!res.ok) throw new SslcommerzError(`Validation request failed (${res.status})`);
      const json = (await res.json()) as {
        status?: string;
        tran_id?: string;
        amount?: string;
        currency_type?: string;
        currency?: string;
        bank_tran_id?: string;
        card_type?: string;
      };
      return {
        status: json.status ?? 'INVALID',
        tranId: json.tran_id ?? '',
        amount: json.amount ?? '0',
        currency: json.currency_type ?? json.currency ?? '',
        bankTranId: json.bank_tran_id ?? '',
        cardType: json.card_type ?? '',
      };
    },
  };
}

export type SslcommerzClient = ReturnType<typeof createSslcommerzClient>;

/** Builds a client from env, or null when BDT payments are not configured. */
export function sslcommerzFromEnv(): SslcommerzClient | null {
  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD;
  if (!storeId || !storePassword) return null;
  return createSslcommerzClient({
    storeId,
    storePassword,
    // Default to sandbox until explicitly flipped for go-live.
    sandbox: process.env.SSLCOMMERZ_SANDBOX !== 'false',
  });
}
