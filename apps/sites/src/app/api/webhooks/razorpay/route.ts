import { NextResponse } from 'next/server';
import { renderDonationReceiptEmail, sendEmail } from '@templeos/email';
import { webhookService } from '@/lib/services';

/**
 * Razorpay webhook receiver. Register in the Razorpay dashboard as
 * https://<sites-host>/api/webhooks/razorpay with the `payment.captured`
 * event and the RAZORPAY_WEBHOOK_SECRET value as the webhook secret.
 *
 * Signature verification happens on the raw body — never parse before
 * verifying. Confirmation is idempotent with the client-side confirm flow,
 * whichever lands first records the payment; the other becomes a no-op.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') ?? '';

  const result = await webhookService().handleEvent(rawBody, signature);

  switch (result.outcome) {
    case 'not_configured':
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    case 'invalid_signature':
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    case 'ignored':
      // 200 so Razorpay does not retry events we deliberately don't handle.
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
          categoryName: result.categoryName ?? undefined,
        });
        // Best-effort — the payment is already recorded regardless.
        await sendEmail({ to: result.email, subject, html });
      }
      return NextResponse.json({ received: true, receiptNumber: result.receiptNumber });
    }
  }
}
