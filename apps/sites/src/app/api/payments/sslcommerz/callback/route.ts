import { NextResponse } from 'next/server';
import { renderDonationReceiptEmail, sendEmail } from '@templeos/email';
import { organizationService, paymentService } from '@/lib/services';

/**
 * SSLCommerz return leg. The gateway POSTs the browser back here after
 * checkout (success_url / fail_url / cancel_url all point at this route).
 *
 * Trust model: the tenant is resolved from the request HOST (same as every
 * public page) — never from the POST body — and the payment itself is only
 * recorded after the validator API confirms the val_id with matching amount.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .toLowerCase()
    .split(':')[0];
  const site = host ? await organizationService().resolveSiteByHostname(host) : null;
  if (!site) {
    return NextResponse.redirect(new URL('/donation-complete?status=failed', url.origin), 303);
  }

  const outcome = url.searchParams.get('outcome');
  if (outcome === 'failed' || outcome === 'cancelled') {
    return NextResponse.redirect(
      new URL(`/donation-complete?status=${outcome}`, url.origin),
      303,
    );
  }

  const form = await request.formData().catch(() => null);
  const valId = form?.get('val_id');
  if (typeof valId !== 'string' || !valId) {
    return NextResponse.redirect(new URL('/donation-complete?status=failed', url.origin), 303);
  }

  const result = await paymentService().confirmSslcommerzDonation(site.organizationId, { valId });
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

/** Direct GET (user refresh/navigation) — send them home. */
export function GET(request: Request) {
  return NextResponse.redirect(new URL('/', new URL(request.url).origin), 303);
}
