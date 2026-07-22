import { and, eq } from 'drizzle-orm';
import {
  auditLogs,
  donations,
  newId,
  organizations,
  paymentOrders,
  withTenantContext,
  type Db,
} from '@templeos/db';
import { allocateReceiptNumber, findOrCreateCategory } from '../donations/donation.repository';

export interface CreatePaymentOrderValues {
  providerOrderId: string;
  amount: string;
  currency: 'INR' | 'BDT';
  donorName: string;
  email: string | null;
  phone: string | null;
  categoryName: string | null;
}

export function createPaymentOrderRepository(db: Db) {
  return {
    async createOrder(organizationId: string, values: CreatePaymentOrderValues) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [row] = await tx
          .insert(paymentOrders)
          .values({
            id: newId(),
            organizationId,
            provider: 'razorpay',
            providerOrderId: values.providerOrderId,
            amount: values.amount,
            currency: values.currency,
            donorName: values.donorName,
            email: values.email,
            phone: values.phone,
            categoryName: values.categoryName,
            status: 'created',
          })
          .returning();
        if (!row) throw new Error('payment order insert returned no row');
        return row;
      });
    },

    /**
     * Verifies the order exists, locks it, and — unless already paid —
     * allocates a receipt and inserts the donation atomically. Row-locked
     * with FOR UPDATE so a double-fired confirm (e.g. client retry) cannot
     * create two donations for one order.
     */
    async confirmPaid(organizationId: string, providerOrderId: string, providerPaymentId: string) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [order] = await tx
          .select()
          .from(paymentOrders)
          .where(
            and(
              eq(paymentOrders.organizationId, organizationId),
              eq(paymentOrders.providerOrderId, providerOrderId),
            ),
          )
          .for('update')
          .limit(1);
        if (!order) return { kind: 'order_not_found' as const };

        if (order.status === 'paid' && order.donationId) {
          const [existing] = await tx
            .select()
            .from(donations)
            .where(eq(donations.id, order.donationId))
            .limit(1);
          if (existing) {
            return { kind: 'ok' as const, donation: existing, email: order.email, alreadyPaid: true };
          }
        }

        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const categoryId = order.categoryName
          ? await findOrCreateCategory(tx, organizationId, order.categoryName)
          : null;
        const receiptNumber = await allocateReceiptNumber(tx, organizationId, new Date().getFullYear());

        const [donation] = await tx
          .insert(donations)
          .values({
            id: newId(),
            organizationId,
            categoryId,
            donorName: order.donorName,
            amount: order.amount,
            currency: org.currency,
            method: 'online',
            reference: providerPaymentId,
            receiptNumber,
            donatedAt: new Date(),
          })
          .returning();
        if (!donation) throw new Error('donation insert returned no row');

        await tx
          .update(paymentOrders)
          .set({ status: 'paid', donationId: donation.id })
          .where(eq(paymentOrders.id, order.id));

        await tx.insert(auditLogs).values({
          organizationId,
          action: 'donation.recorded_online',
          entityType: 'donation',
          entityId: donation.id,
          after: {
            receiptNumber: donation.receiptNumber,
            amount: donation.amount,
            provider: 'razorpay',
            providerPaymentId,
          },
        });

        return { kind: 'ok' as const, donation, email: order.email, alreadyPaid: false };
      });
    },
  };
}

export type PaymentOrderRepository = ReturnType<typeof createPaymentOrderRepository>;
