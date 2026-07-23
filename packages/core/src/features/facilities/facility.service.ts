import { eq } from 'drizzle-orm';
import { organizations, withTenantContext, type Db } from '@templeos/db';
import { facilityBookingRequestSchema, facilitySchema } from '@templeos/validators';
import {
  authorize,
  conflict,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createFacilityRepository } from './facility.repository';
import type {
  FacilityBookingSummary,
  FacilitySummary,
  PublicFacility,
} from './facility.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

function toFacility(row: {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  rentAmount: string;
  currency: 'INR' | 'BDT';
  isActive: boolean;
}): FacilitySummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    capacity: row.capacity,
    rentAmount: row.rentAmount,
    currency: row.currency,
    isActive: row.isActive,
  };
}

function toBooking(row: {
  id: string;
  facilityId: string;
  facilityName: string;
  bookerName: string;
  phone: string | null;
  email: string | null;
  eventDate: string;
  purpose: string | null;
  amount: string;
  currency: 'INR' | 'BDT';
  status: 'requested' | 'confirmed' | 'cancelled';
  note: string | null;
  createdAt: Date;
}): FacilityBookingSummary {
  return {
    id: row.id,
    facilityId: row.facilityId,
    facilityName: row.facilityName,
    bookerName: row.bookerName,
    phone: row.phone,
    email: row.email,
    eventDate: row.eventDate,
    purpose: row.purpose,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt,
  };
}

export function createFacilityService({ db }: { db: Db }) {
  const repo = createFacilityRepository(db);

  return {
    async listFacilities(ctx: TenantContext): Promise<Result<FacilitySummary[]>> {
      const auth = authorize(ctx, 'facilities:read');
      if (!auth.ok) return auth;
      const rows = await repo.listFacilities(ctx);
      return ok(rows.map(toFacility));
    },

    async createFacility(ctx: TenantContext, rawInput: unknown): Promise<Result<FacilitySummary>> {
      const auth = authorize(ctx, 'facilities:write');
      if (!auth.ok) return auth;
      const parsed = facilitySchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const currency = await withTenantContext(
        db,
        { organizationId: ctx.organizationId },
        async (tx) => {
          const [org] = await tx
            .select({ currency: organizations.currency })
            .from(organizations)
            .where(eq(organizations.id, ctx.organizationId))
            .limit(1);
          return org?.currency ?? 'INR';
        },
      );

      const row = await repo.createFacility(ctx, parsed.data, currency);
      return ok(toFacility(row));
    },

    async setFacilityActive(
      ctx: TenantContext,
      facilityId: string,
      isActive: boolean,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'facilities:write');
      if (!auth.ok) return auth;
      const updated = await repo.setFacilityActive(ctx, facilityId, isActive);
      if (!updated) return err(notFound('Facility'));
      return ok(null);
    },

    async listBookings(
      ctx: TenantContext,
      status: 'requested' | 'confirmed' | 'cancelled' | 'all',
    ): Promise<Result<FacilityBookingSummary[]>> {
      const auth = authorize(ctx, 'facilities:read');
      if (!auth.ok) return auth;
      const rows = await repo.listBookings(ctx, status);
      return ok(rows.map(toBooking));
    },

    async confirmBooking(ctx: TenantContext, bookingId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'facilities:write');
      if (!auth.ok) return auth;
      const result = await repo.confirmBooking(ctx, bookingId);
      if (result.kind === 'not_found') return err(notFound('Booking'));
      if (result.kind === 'slot_taken') {
        return err(conflict('That date is already confirmed for this facility'));
      }
      return ok(null);
    },

    async cancelBooking(ctx: TenantContext, bookingId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'facilities:write');
      if (!auth.ok) return auth;
      const updated = await repo.cancelBooking(ctx, bookingId);
      if (!updated) return err(notFound('Booking'));
      return ok(null);
    },

    // ---- Public ----
    async listPublicFacilities(organizationId: string): Promise<PublicFacility[]> {
      const rows = await repo.listActiveFacilities(organizationId);
      return rows.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        capacity: f.capacity,
        rentAmount: f.rentAmount,
        currency: f.currency,
      }));
    },

    async requestBooking(
      organizationId: string,
      rawInput: unknown,
    ): Promise<Result<{ facilityName: string; eventDate: string }>> {
      const parsed = facilityBookingRequestSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.requestBooking(organizationId, parsed.data);
      if (result.kind === 'not_found') return err(notFound('Facility'));
      if (result.kind === 'date_taken') {
        return err(conflict('That date is already booked. Please choose another.'));
      }
      return ok({ facilityName: result.booking.facilityName, eventDate: result.booking.eventDate });
    },
  };
}

export type FacilityService = ReturnType<typeof createFacilityService>;
