import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { organizations, withTenantContext, type Db } from '@templeos/db';
import { createMembershipRepository } from '../membership/membership.repository';
import { createPujaRepository } from '../pujas/puja.repository';
import { createPaymentOrderRepository } from './order.repository';

/**
 * Razorpay webhook handling — the server-side complement to the client-driven
 * confirm flow. If a devotee closes the tab after paying but before our
 * Checkout handler runs, the `payment.captured` webhook still lands here and
 * records the payment. Both paths funnel into the same row-locked, idempotent
 * repo confirms, so double delivery can never double-record.
 *
 * Webhook authenticity: Razorpay signs the raw request body with the webhook
 * secret (HMAC-SHA256, hex) — a different secret from the key pair, chosen
 * when the webhook is registered in the Razorpay dashboard.
 */

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

interface RazorpayWebhookEvent {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        notes?: Record<string, string> | string[];
      };
    };
  };
}

export type WebhookOutcome =
  | { outcome: 'not_configured' }
  | { outcome: 'invalid_signature' }
  | { outcome: 'ignored'; reason: string }
  | {
      outcome: 'confirmed';
      kind: 'donation' | 'puja' | 'membership';
      alreadyPaid: boolean;
      organizationName: string;
      email: string | null;
      receiptNumber: string;
      amount: string;
      currency: 'INR' | 'BDT';
      donorName: string;
      /** Receipt line item for pujas/memberships, e.g. "Puja: Satyanarayan". */
      categoryName: string | null;
    };

export function createWebhookService({ db }: { db: Db }) {
  const orderRepo = createPaymentOrderRepository(db);
  const pujaRepo = createPujaRepository(db);
  const membershipRepo = createMembershipRepository(db);

  async function organizationName(organizationId: string): Promise<string> {
    return withTenantContext(db, { organizationId }, async (tx) => {
      const [org] = await tx
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      return org?.name ?? 'Temple';
    });
  }

  async function dispatch(
    kind: 'donation' | 'puja' | 'membership',
    organizationId: string,
    orderId: string,
    paymentId: string,
  ): Promise<WebhookOutcome | null> {
    if (kind === 'donation') {
      const result = await orderRepo.confirmPaid(organizationId, orderId, paymentId);
      if (result.kind !== 'ok') return null;
      return {
        outcome: 'confirmed',
        kind,
        alreadyPaid: result.alreadyPaid,
        organizationName: await organizationName(organizationId),
        email: result.email,
        receiptNumber: result.donation.receiptNumber,
        amount: result.donation.amount,
        currency: result.donation.currency,
        donorName: result.donation.donorName,
        categoryName: null,
      };
    }
    if (kind === 'puja') {
      const result = await pujaRepo.confirmBookingPaid(organizationId, orderId, paymentId);
      if (result.kind !== 'ok') return null;
      return {
        outcome: 'confirmed',
        kind,
        alreadyPaid: result.alreadyPaid,
        organizationName: await organizationName(organizationId),
        email: result.booking.email,
        receiptNumber: result.donation.receiptNumber,
        amount: result.donation.amount,
        currency: result.donation.currency,
        donorName: result.booking.devoteeName,
        categoryName: `Puja: ${result.booking.pujaName}`,
      };
    }
    const result = await membershipRepo.confirmSubscriptionPaid(organizationId, orderId, paymentId);
    if (result.kind !== 'ok') return null;
    return {
      outcome: 'confirmed',
      kind,
      alreadyPaid: result.alreadyPaid,
      organizationName: await organizationName(organizationId),
      email: result.subscription.email,
      receiptNumber: result.donation.receiptNumber,
      amount: result.donation.amount,
      currency: result.donation.currency,
      donorName: result.subscription.memberName,
      categoryName: `Membership: ${result.subscription.planName}`,
    };
  }

  return {
    isConfigured(): boolean {
      return Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);
    },

    async handleEvent(rawBody: string, signature: string): Promise<WebhookOutcome> {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!secret) return { outcome: 'not_configured' };
      if (!signature || !verifyWebhookSignature(rawBody, signature, secret)) {
        return { outcome: 'invalid_signature' };
      }

      let event: RazorpayWebhookEvent;
      try {
        event = JSON.parse(rawBody) as RazorpayWebhookEvent;
      } catch {
        return { outcome: 'ignored', reason: 'unparseable body' };
      }

      if (event.event !== 'payment.captured') {
        return { outcome: 'ignored', reason: `event ${event.event ?? 'unknown'}` };
      }

      const entity = event.payload?.payment?.entity;
      const orderId = entity?.order_id;
      const paymentId = entity?.id;
      // Razorpay serializes empty notes as [] instead of {}
      const notes =
        entity?.notes && !Array.isArray(entity.notes) ? entity.notes : ({} as Record<string, string>);
      const organizationId = notes.organizationId;
      if (!orderId || !paymentId) return { outcome: 'ignored', reason: 'missing order/payment id' };
      if (!organizationId) return { outcome: 'ignored', reason: 'no organizationId in notes' };

      // Order notes tell us which checkout flow created the order; unknown or
      // stale notes fall back to probing the other stores (all idempotent).
      const attempts: Array<'donation' | 'puja' | 'membership'> = notes.pujaTypeId
        ? ['puja', 'donation', 'membership']
        : notes.planId
          ? ['membership', 'donation', 'puja']
          : ['donation', 'puja', 'membership'];

      for (const kind of attempts) {
        const outcome = await dispatch(kind, organizationId, orderId, paymentId);
        if (outcome) return outcome;
      }
      return { outcome: 'ignored', reason: 'order not found' };
    },
  };
}

export type WebhookService = ReturnType<typeof createWebhookService>;
