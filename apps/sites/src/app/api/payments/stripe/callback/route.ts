import { NextResponse } from 'next/server';
import { renderDonationReceiptEmail, sendEmail } from '@templeos/email';
import { organizationService, paymentService } from '@/lib/services';

/**
 * Stripe Checkout return leg. success_url points here with
 * ?session_id={CHECKOUT_SESSION_ID}; cancel_url points here with
 * ?outcome=cancelled. Unlike SSLCommerz this is a GET (Stripe redirects the
 * browser, it doesn't POST), and the session is re-fetched from Stripe
 * server-side rather than trusted from the query string.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .toLowerCase()
    .split(':')[0];
  const site = host ? await organizationService().resolveSiteByHostname(host) : null;
  if (!site) {
    return NextResponse.redirect(new URL('/donation-complete?status=failed', url.origin), 303);
  }

  const outcome = url.searchParams.get('outcome');
  if (outcome === 'cancelled') {
    return NextResponse.redirect(new URL('/donation-complete?status=cancelled', url.origin), 303);
  }

  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.redirect(new URL('/donation-complete?status=failed', url.origin), 303);
  }

  const result = await paymentService().confirmStripeDonation(site.organizationId, sessionId);
  if (!result.ok) {
    return NextResponse.redirect(new URL('/donation-complete?status=failed', url.origin), 303);
  }

  if (!result.value.alreadyPaid && result.value.email) {
    const { subject, html } = renderDonationReceiptEmail({
      organizationName: site.name,
      donorName: result.value.donorName,
      amount: result.value.amount,
      currency: result.value.currency,
      receiptNumber: result.value.receiptNumber,
      donatedAt: new Date(),
    });
    // Best-effort — the donation is already recorded regardless.
    await sendEmail({ to: result.value.email, subject, html });
  }

  const done = new URL('/donation-complete', url.origin);
  done.searchParams.set('status', 'ok');
  done.searchParams.set('receipt', result.value.receiptNumber);
  return NextResponse.redirect(done, 303);
}
