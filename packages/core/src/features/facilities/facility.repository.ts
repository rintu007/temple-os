import { and, desc, eq } from 'drizzle-orm';
import {
  auditLogs,
  facilities,
  facilityBookings,
  newId,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { FacilityBookingRequestInput, FacilityInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

export function createFacilityRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async listFacilities(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select()
          .from(facilities)
          .where(eq(facilities.organizationId, ctx.organizationId))
          .orderBy(desc(facilities.createdAt)),
      );
    },

    async createFacility(ctx: TenantContext, input: FacilityInput, currency: 'INR' | 'BDT') {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(facilities)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            name: input.name,
            description: input.description ?? null,
            capacity: input.capacity ?? null,
            rentAmount: input.rentAmount.toFixed(2),
            currency,
          })
          .returning();
        if (!row) throw new Error('facility insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'facility.created',
          entityType: 'facility',
          entityId: row.id,
          after: { name: row.name },
        });
        return row;
      });
    },

    async setFacilityActive(ctx: TenantContext, facilityId: string, isActive: boolean) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(facilities)
          .set({ isActive })
          .where(eq(facilities.id, facilityId))
          .returning();
        return updated ?? null;
      });
    },

    async listBookings(
      ctx: TenantContext,
      status: 'requested' | 'confirmed' | 'cancelled' | 'all',
    ) {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where =
          status === 'all'
            ? eq(facilityBookings.organizationId, ctx.organizationId)
            : and(
                eq(facilityBookings.organizationId, ctx.organizationId),
                eq(facilityBookings.status, status),
              );
        return tx
          .select()
          .from(facilityBookings)
          .where(where)
          .orderBy(desc(facilityBookings.createdAt));
      });
    },

    /**
     * Confirms a booking after checking no other confirmed booking holds the
     * facility+date. The pre-check is the primary guard; the partial unique
     * index `facility_bookings_confirmed_slot_uq` is the DB-level backstop for
     * the rare concurrent race (a catch here can't recover an aborted tx —
     * only a savepoint could — so the index simply prevents the bad state).
     */
    async confirmBooking(ctx: TenantContext, bookingId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [booking] = await tx
          .select()
          .from(facilityBookings)
          .where(eq(facilityBookings.id, bookingId))
          .limit(1);
        if (!booking) return { kind: 'not_found' as const };
        if (booking.status === 'confirmed') return { kind: 'ok' as const, booking };

        const [clash] = await tx
          .select({ id: facilityBookings.id })
          .from(facilityBookings)
          .where(
            and(
              eq(facilityBookings.facilityId, booking.facilityId),
              eq(facilityBookings.eventDate, booking.eventDate),
              eq(facilityBookings.status, 'confirmed'),
            ),
          )
          .limit(1);
        if (clash) return { kind: 'slot_taken' as const };

        const [updated] = await tx
          .update(facilityBookings)
          .set({ status: 'confirmed' })
          .where(eq(facilityBookings.id, bookingId))
          .returning();
        if (!updated) return { kind: 'not_found' as const };

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'facility_booking.confirmed',
          entityType: 'facility_booking',
          entityId: bookingId,
          after: { facilityName: updated.facilityName, eventDate: updated.eventDate },
        });
        return { kind: 'ok' as const, booking: updated };
      });
    },

    async cancelBooking(ctx: TenantContext, bookingId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(facilityBookings)
          .set({ status: 'cancelled' })
          .where(eq(facilityBookings.id, bookingId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'facility_booking.cancelled',
          entityType: 'facility_booking',
          entityId: bookingId,
        });
        return updated;
      });
    },

    // ---- Public flow ----
    async listActiveFacilities(organizationId: string) {
      return withTenantContext(db, { organizationId }, (tx) =>
        tx
          .select()
          .from(facilities)
          .where(and(eq(facilities.organizationId, organizationId), eq(facilities.isActive, true)))
          .orderBy(desc(facilities.createdAt)),
      );
    },

    async requestBooking(organizationId: string, input: FacilityBookingRequestInput) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [facility] = await tx
          .select()
          .from(facilities)
          .where(
            and(eq(facilities.id, input.facilityId), eq(facilities.organizationId, organizationId)),
          )
          .limit(1);
        if (!facility || !facility.isActive) return { kind: 'not_found' as const };

        // Surface the obvious clash early; the index is the real guard at confirm.
        const [clash] = await tx
          .select({ id: facilityBookings.id })
          .from(facilityBookings)
          .where(
            and(
              eq(facilityBookings.facilityId, input.facilityId),
              eq(facilityBookings.eventDate, input.eventDate),
              eq(facilityBookings.status, 'confirmed'),
            ),
          )
          .limit(1);
        if (clash) return { kind: 'date_taken' as const };

        const [row] = await tx
          .insert(facilityBookings)
          .values({
            id: newId(),
            organizationId,
            facilityId: facility.id,
            facilityName: facility.name,
            bookerName: input.bookerName,
            phone: input.phone,
            email: input.email ?? null,
            eventDate: input.eventDate,
            purpose: input.purpose ?? null,
            amount: facility.rentAmount,
            currency: facility.currency,
            note: input.note ?? null,
          })
          .returning();
        if (!row) throw new Error('facility booking insert returned no row');
        return { kind: 'ok' as const, booking: row };
      });
    },
  };
}

export type FacilityRepository = ReturnType<typeof createFacilityRepository>;
