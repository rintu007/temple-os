import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import {
  auditLogs,
  donations,
  newId,
  organizations,
  pujaBookings,
  pujaTypes,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { PujaTypeInput } from '@templeos/validators';
import { allocateReceiptNumber, findOrCreateCategory } from '../donations/donation.repository';
import type { TenantContext } from '../../shared';

const typeNotDeleted = isNull(pujaTypes.deletedAt);

export function createPujaRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    // ---- Puja types (admin) ----
    async listTypes(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select()
          .from(pujaTypes)
          .where(and(eq(pujaTypes.organizationId, ctx.organizationId), typeNotDeleted))
          .orderBy(asc(pujaTypes.createdAt)),
      );
    },

    async findType(ctx: TenantContext, typeId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select()
          .from(pujaTypes)
          .where(and(eq(pujaTypes.id, typeId), typeNotDeleted))
          .limit(1);
        return row ?? null;
      });
    },

    async createType(ctx: TenantContext, input: PujaTypeInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const [type] = await tx
          .insert(pujaTypes)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            name: input.name,
            description: input.description ?? null,
            price: input.price.toFixed(2),
            currency: org.currency,
            isActive: input.isActive,
          })
          .returning();
        if (!type) throw new Error('puja type insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'puja_type.created',
          entityType: 'puja_type',
          entityId: type.id,
          after: { name: type.name, price: type.price },
        });
        return type;
      });
    },

    async updateType(ctx: TenantContext, typeId: string, input: PujaTypeInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [existing] = await tx
          .select()
          .from(pujaTypes)
          .where(and(eq(pujaTypes.id, typeId), typeNotDeleted))
          .limit(1);
        if (!existing) return null;

        const [updated] = await tx
          .update(pujaTypes)
          .set({
            name: input.name,
            description: input.description ?? null,
            price: input.price.toFixed(2),
            isActive: input.isActive,
          })
          .where(eq(pujaTypes.id, typeId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'puja_type.updated',
          entityType: 'puja_type',
          entityId: typeId,
          before: { name: existing.name, price: existing.price, isActive: existing.isActive },
          after: { name: updated.name, price: updated.price, isActive: updated.isActive },
        });
        return updated;
      });
    },

    async deleteType(ctx: TenantContext, typeId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [removed] = await tx
          .update(pujaTypes)
          .set({ deletedAt: new Date() })
          .where(and(eq(pujaTypes.id, typeId), typeNotDeleted))
          .returning();
        if (!removed) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'puja_type.deleted',
          entityType: 'puja_type',
          entityId: typeId,
          before: { name: removed.name },
        });
        return removed;
      });
    },

    // ---- Bookings (admin queue) ----
    async listBookings(
      ctx: TenantContext,
      query: { status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'all'; page: number; pageSize: number },
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const statusFilter =
          query.status === 'all' ? undefined : eq(pujaBookings.status, query.status);
        // Only paid-through bookings matter to staff; hide abandoned 'pending' unless asked.
        const where =
          query.status === 'all'
            ? and(eq(pujaBookings.organizationId, ctx.organizationId))
            : and(eq(pujaBookings.organizationId, ctx.organizationId), statusFilter);

        const [items, [totalRow]] = await Promise.all([
          tx
            .select()
            .from(pujaBookings)
            .where(where)
            .orderBy(desc(pujaBookings.createdAt))
            .limit(query.pageSize)
            .offset((query.page - 1) * query.pageSize),
          tx.select({ value: count() }).from(pujaBookings).where(where),
        ]);
        return { items, total: totalRow?.value ?? 0 };
      });
    },

    async setBookingStatus(
      ctx: TenantContext,
      bookingId: string,
      status: 'completed' | 'cancelled',
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(pujaBookings)
          .set({ status })
          .where(eq(pujaBookings.id, bookingId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: status === 'completed' ? 'puja_booking.completed' : 'puja_booking.cancelled',
          entityType: 'puja_booking',
          entityId: bookingId,
        });
        return updated;
      });
    },

    // ---- Public booking flow (org-scoped, no user) ----
    async listPublicTypes(organizationId: string) {
      return withTenantContext(db, { organizationId }, (tx) =>
        tx
          .select()
          .from(pujaTypes)
          .where(
            and(
              eq(pujaTypes.organizationId, organizationId),
              eq(pujaTypes.isActive, true),
              typeNotDeleted,
            ),
          )
          .orderBy(asc(pujaTypes.createdAt)),
      );
    },

    async findPublicType(organizationId: string, typeId: string) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [row] = await tx
          .select()
          .from(pujaTypes)
          .where(
            and(
              eq(pujaTypes.id, typeId),
              eq(pujaTypes.organizationId, organizationId),
              eq(pujaTypes.isActive, true),
              typeNotDeleted,
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    async createPendingBooking(
      organizationId: string,
      values: {
        pujaTypeId: string;
        pujaName: string;
        devoteeName: string;
        email: string | null;
        phone: string | null;
        amount: string;
        currency: 'INR' | 'BDT';
        preferredDate: string | null;
        note: string | null;
        providerOrderId: string;
      },
    ) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [booking] = await tx
          .insert(pujaBookings)
          .values({
            id: newId(),
            organizationId,
            pujaTypeId: values.pujaTypeId,
            pujaName: values.pujaName,
            devoteeName: values.devoteeName,
            email: values.email,
            phone: values.phone,
            amount: values.amount,
            currency: values.currency,
            preferredDate: values.preferredDate,
            note: values.note,
            status: 'pending',
            provider: 'razorpay',
            providerOrderId: values.providerOrderId,
          })
          .returning();
        if (!booking) throw new Error('booking insert returned no row');
        return booking;
      });
    },

    /**
     * Confirms a paid booking: locks the row, and unless already confirmed,
     * records a donation (income + receipt) and flips the booking to
     * 'confirmed'. Idempotent via the FOR UPDATE lock + status check.
     */
    async confirmBookingPaid(
      organizationId: string,
      providerOrderId: string,
      providerPaymentId: string,
    ) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [booking] = await tx
          .select()
          .from(pujaBookings)
          .where(
            and(
              eq(pujaBookings.organizationId, organizationId),
              eq(pujaBookings.providerOrderId, providerOrderId),
            ),
          )
          .for('update')
          .limit(1);
        if (!booking) return { kind: 'booking_not_found' as const };

        if (booking.status !== 'pending') {
          // Already processed — find the matching donation receipt to return.
          const [existing] = await tx
            .select()
            .from(donations)
            .where(eq(donations.reference, providerPaymentId))
            .limit(1);
          if (existing) {
            return { kind: 'ok' as const, booking, donation: existing };
          }
        }

        const categoryId = await findOrCreateCategory(tx, organizationId, `Puja: ${booking.pujaName}`);
        const receiptNumber = await allocateReceiptNumber(tx, organizationId, new Date().getFullYear());

        const [donation] = await tx
          .insert(donations)
          .values({
            id: newId(),
            organizationId,
            categoryId,
            donorName: booking.devoteeName,
            amount: booking.amount,
            currency: booking.currency,
            method: 'online',
            reference: providerPaymentId,
            note: `Puja booking: ${booking.pujaName}`,
            receiptNumber,
            donatedAt: new Date(),
          })
          .returning();
        if (!donation) throw new Error('donation insert returned no row');

        const [confirmed] = await tx
          .update(pujaBookings)
          .set({ status: 'confirmed', providerPaymentId })
          .where(eq(pujaBookings.id, booking.id))
          .returning();

        await tx.insert(auditLogs).values({
          organizationId,
          action: 'puja_booking.confirmed',
          entityType: 'puja_booking',
          entityId: booking.id,
          after: {
            pujaName: booking.pujaName,
            receiptNumber: donation.receiptNumber,
            providerPaymentId,
          },
        });

        return { kind: 'ok' as const, booking: confirmed ?? booking, donation };
      });
    },
  };
}

export type PujaRepository = ReturnType<typeof createPujaRepository>;
