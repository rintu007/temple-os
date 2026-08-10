import { NextResponse } from 'next/server';
import { renderDonationReceiptEmail, sendEmail } from '@templeos/email';
import { webhookService } from '@/lib/services';

/**
 * Stripe webhook receiver. Register in the Stripe dashboard as
 * https://<sites-host>/api/webhooks/stripe with the `checkout.session.completed`
 * AND `checkout.session.expired` events, and the STRIPE_WEBHOOK_SECRET value
 * as the endpoint secret. `checkout.session.expired` records an abandoned
 * checkout as failed so it surfaces to staff (see
 * apps/admin/src/app/(dashboard)/payments/failed) instead of leaving the
 * order silently stuck at 'created'.
 *
 * Signature verification happens on the raw body via the Stripe SDK — never
 * parse before verifying. Confirmation is idempotent with the client-side
 * confirm flow (the callback route), whichever lands first records the
 * payment; the other becomes a no-op.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';

  const result = await webhookService().handleStripeEvent(rawBody, signature);

  switch (result.outcome) {
    case 'not_configured':
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    case 'invalid_signature':
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    case 'ignored':
      // 200 so Stripe does not retry events we deliberately don't handle.
      return NextResponse.json({ received: true, ignored: result.reason });
    case 'confirmed': {
      if (!result.alreadyPaid && result.email) {
        const { subject, html } = renderDonationReceiptEmail({
          organizationName: result.organizationName,
          donorName: result.donorName,
          amount: result.amount,
          currency: result.currency,
          receiptNumber: result.receiptNumber,
          donatedAt: new Date(),
        });
        // Best-effort — the payment is already recorded regardless.
        await sendEmail({ to: result.email, subject, html });
      }
      return NextResponse.json({ received: true, receiptNumber: result.receiptNumber });
    }
  }
}
