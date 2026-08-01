import { NextResponse } from 'next/server';
import { renderPaymentFailedEmail, sendEmail } from '@templeos/email';
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
      if (result.becamePastDue) {
        await notifyPastDue(result.organizationId);
      }
      return NextResponse.json({ received: true });
  }
}

/**
 * Best-effort: a notification email is a side effect of an already-applied
 * billing state change and must never make the webhook response fail, so
 * failures here are swallowed (sendEmail itself never throws — see
 * packages/email/src/client.ts).
 */
async function notifyPastDue(organizationId: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const { organizationName, owners } = await billingService().getBillingNoticeContext(organizationId);
  const { subject, html } = renderPaymentFailedEmail({
    organizationName,
    billingUrl: `${appUrl}/billing`,
  });
  await Promise.all(owners.map((owner) => sendEmail({ to: owner.email, subject, html })));
}
