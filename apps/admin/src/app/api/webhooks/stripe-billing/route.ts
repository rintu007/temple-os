import { NextResponse } from 'next/server';
import { billingService } from '@/lib/services';

/**
 * Stripe webhook for TempleOS's own subscription billing — register in the
 * Stripe dashboard as https://<admin-host>/api/webhooks/stripe-billing with
 * events `checkout.session.completed`, `customer.subscription.updated`, and
 * `customer.subscription.deleted`, using the STRIPE_BILLING_WEBHOOK_SECRET
 * value as the endpoint secret.
 *
 * Distinct from apps/sites' /api/webhooks/stripe, which is devotee donation
 * checkout — different Stripe endpoint, different secret, different concern.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';

  const result = await billingService().handleStripeEvent(rawBody, signature);

  switch (result.outcome) {
    case 'not_configured':
      return NextResponse.json({ error: 'Billing webhook not configured' }, { status: 503 });
    case 'invalid_signature':
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    case 'ignored':
      // 200 so Stripe does not retry events we deliberately don't handle.
      return NextResponse.json({ received: true, reason: result.reason });
    case 'confirmed':
      return NextResponse.json({ received: true });
  }
}
