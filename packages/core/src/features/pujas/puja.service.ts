import type { Db } from '@templeos/db';
import {
  assignSevaSchema,
  confirmDonationOrderSchema,
  createBookingOrderSchema,
  priestSchema,
  pujaTypeSchema,
} from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { razorpayFromEnv } from '../payments/razorpay';
import { createPujaRepository } from './puja.repository';
import type {
  BookingOrder,
  ConfirmedBooking,
  PriestSummary,
  PublicPujaType,
  PujaBookingPage,
  PujaBookingSummary,
  PujaTypeSummary,
} from './puja.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

export function createPujaService({ db }: { db: Db }) {
  const repo = createPujaRepository(db);

  const toTypeSummary = (t: {
    id: string;
    name: string;
    description: string | null;
    price: string;
    currency: 'INR' | 'BDT';
    isActive: boolean;
  }): PujaTypeSummary => ({
    id: t.id,
    name: t.name,
    description: t.description,
    price: t.price,
    currency: t.currency,
    isActive: t.isActive,
  });

  const toBookingSummary = (b: {
    id: string;
    pujaName: string;
    devoteeName: string;
    email: string | null;
    phone: string | null;
    amount: string;
    currency: 'INR' | 'BDT';
    preferredDate: string | null;
    note: string | null;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    createdAt: Date;
    priestId?: string | null;
    priestName?: string | null;
    scheduledOn?: string | null;
    scheduledTime?: string | null;
  }): PujaBookingSummary => ({
    id: b.id,
    pujaName: b.pujaName,
    devoteeName: b.devoteeName,
    email: b.email,
    phone: b.phone,
    amount: b.amount,
    currency: b.currency,
    preferredDate: b.preferredDate,
    note: b.note,
    status: b.status,
    createdAt: b.createdAt,
    priestId: b.priestId ?? null,
    priestName: b.priestName ?? null,
    scheduledOn: b.scheduledOn ?? null,
    scheduledTime: b.scheduledTime ?? null,
  });

  return {
    // ---- Admin: puja type management ----
    async listPujaTypes(ctx: TenantContext): Promise<Result<PujaTypeSummary[]>> {
      const auth = authorize(ctx, 'pujas:read');
      if (!auth.ok) return auth;
      const rows = await repo.listTypes(ctx);
      return ok(rows.map(toTypeSummary));
    },

    async getPujaType(ctx: TenantContext, typeId: string): Promise<Result<PujaTypeSummary>> {
      const auth = authorize(ctx, 'pujas:read');
      if (!auth.ok) return auth;
      const row = await repo.findType(ctx, typeId);
      if (!row) return err(notFound('Puja'));
      return ok(toTypeSummary(row));
    },

    async createPujaType(ctx: TenantContext, rawInput: unknown): Promise<Result<PujaTypeSummary>> {
      const auth = authorize(ctx, 'pujas:write');
      if (!auth.ok) return auth;
      const parsed = pujaTypeSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const type = await repo.createType(ctx, parsed.data);
      return ok(toTypeSummary(type));
    },

    async updatePujaType(
      ctx: TenantContext,
      typeId: string,
      rawInput: unknown,
    ): Promise<Result<PujaTypeSummary>> {
      const auth = authorize(ctx, 'pujas:write');
      if (!auth.ok) return auth;
      const parsed = pujaTypeSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const updated = await repo.updateType(ctx, typeId, parsed.data);
      if (!updated) return err(notFound('Puja'));
      return ok(toTypeSummary(updated));
    },

    async deletePujaType(ctx: TenantContext, typeId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'pujas:write');
      if (!auth.ok) return auth;
      const removed = await repo.deleteType(ctx, typeId);
      if (!removed) return err(notFound('Puja'));
      return ok(null);
    },

    // ---- Admin: booking queue ----
    async listBookings(ctx: TenantContext, rawQuery: unknown): Promise<Result<PujaBookingPage>> {
      const auth = authorize(ctx, 'pujas:read');
      if (!auth.ok) return auth;
      const q = (rawQuery ?? {}) as { status?: string; page?: number; pageSize?: number };
      const status =
        q.status === 'confirmed' ||
        q.status === 'completed' ||
        q.status === 'cancelled' ||
        q.status === 'all'
          ? q.status
          : 'confirmed';
      const page = Math.max(1, Number(q.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25));

      const { items, total } = await repo.listBookings(ctx, { status, page, pageSize });
      return ok({ items: items.map(toBookingSummary), total, page, pageSize });
    },

    async markBookingCompleted(ctx: TenantContext, bookingId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'pujas:write');
      if (!auth.ok) return auth;
      const updated = await repo.setBookingStatus(ctx, bookingId, 'completed');
      if (!updated) return err(notFound('Booking'));
      return ok(null);
    },

    async cancelBooking(ctx: TenantContext, bookingId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'pujas:write');
      if (!auth.ok) return auth;
      const updated = await repo.setBookingStatus(ctx, bookingId, 'cancelled');
      if (!updated) return err(notFound('Booking'));
      return ok(null);
    },

    // ---- Seva scheduling ----
    async listPriests(ctx: TenantContext): Promise<Result<PriestSummary[]>> {
      const auth = authorize(ctx, 'pujas:read');
      if (!auth.ok) return auth;
      const rows = await repo.listPriests(ctx);
      return ok(
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          specialty: p.specialty,
          isActive: p.isActive,
        })),
      );
    },

    async createPriest(ctx: TenantContext, rawInput: unknown): Promise<Result<PriestSummary>> {
      const auth = authorize(ctx, 'pujas:write');
      if (!auth.ok) return auth;
      const parsed = priestSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const p = await repo.createPriest(ctx, parsed.data);
      return ok({
        id: p.id,
        name: p.name,
        phone: p.phone,
        specialty: p.specialty,
        isActive: p.isActive,
      });
    },

    async setPriestActive(
      ctx: TenantContext,
      priestId: string,
      isActive: boolean,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'pujas:write');
      if (!auth.ok) return auth;
      const updated = await repo.setPriestActive(ctx, priestId, isActive);
      if (!updated) return err(notFound('Priest'));
      return ok(null);
    },

    async assignSeva(
      ctx: TenantContext,
      bookingId: string,
      rawInput: unknown,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'pujas:write');
      if (!auth.ok) return auth;
      const parsed = assignSevaSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.assignSeva(ctx, bookingId, parsed.data);
      if (result.kind === 'priest_not_found') return err(notFound('Priest'));
      if (result.kind === 'booking_not_found') return err(notFound('Booking'));
      return ok(null);
    },

    /** The day's seva schedule — scheduled bookings for a calendar date. */
    async listSevaDay(ctx: TenantContext, day: string): Promise<Result<PujaBookingSummary[]>> {
      const auth = authorize(ctx, 'pujas:read');
      if (!auth.ok) return auth;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        return err(domainError('VALIDATION', 'Use YYYY-MM-DD'));
      }
      const rows = await repo.listSevaDay(ctx, day);
      return ok(rows.map(toBookingSummary));
    },

    // ---- Public: catalog + booking checkout ----
    async listPublicPujaTypes(organizationId: string): Promise<PublicPujaType[]> {
      const rows = await repo.listPublicTypes(organizationId);
      return rows.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        price: t.price,
        currency: t.currency,
      }));
    },

    async createBookingOrder(
      organizationId: string,
      organizationCurrency: 'INR' | 'BDT',
      rawInput: unknown,
    ): Promise<Result<BookingOrder>> {
      const razorpay = razorpayFromEnv();
      if (!razorpay) return err(domainError('VALIDATION', 'Online booking is not configured'));
      if (organizationCurrency !== 'INR') {
        return err(domainError('VALIDATION', 'Online booking is not yet available for this currency'));
      }
      const parsed = createBookingOrderSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const input = parsed.data;

      const type = await repo.findPublicType(organizationId, input.pujaTypeId);
      if (!type) return err(notFound('Puja'));

      const amountPaise = Math.round(Number(type.price) * 100);
      const order = await razorpay.createOrder({
        amountPaise,
        currency: 'INR',
        notes: { organizationId, pujaTypeId: type.id },
      });

      await repo.createPendingBooking(organizationId, {
        pujaTypeId: type.id,
        pujaName: type.name,
        devoteeName: input.devoteeName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        amount: type.price,
        currency: 'INR',
        preferredDate: input.preferredDate ?? null,
        note: input.note ?? null,
        providerOrderId: order.id,
      });

      return {
        ok: true,
        value: { orderId: order.id, amountPaise, currency: 'INR', keyId: razorpay.keyId, pujaName: type.name },
      };
    },

    async confirmBooking(
      organizationId: string,
      rawInput: unknown,
    ): Promise<Result<ConfirmedBooking>> {
      const razorpay = razorpayFromEnv();
      if (!razorpay) return err(domainError('VALIDATION', 'Online booking is not configured'));
      const parsed = confirmDonationOrderSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const { providerOrderId, providerPaymentId, signature } = parsed.data;

      const validSignature = razorpay.verifyPaymentSignature({
        orderId: providerOrderId,
        paymentId: providerPaymentId,
        signature,
      });
      if (!validSignature) return err(domainError('FORBIDDEN', 'Payment could not be verified'));

      const result = await repo.confirmBookingPaid(organizationId, providerOrderId, providerPaymentId);
      if (result.kind === 'booking_not_found') return err(notFound('Booking'));

      return ok({
        receiptNumber: result.donation.receiptNumber,
        pujaName: result.booking.pujaName,
        amount: result.donation.amount,
        currency: result.donation.currency,
        devoteeName: result.booking.devoteeName,
        alreadyPaid: result.alreadyPaid,
      });
    },
  };
}

export type PujaService = ReturnType<typeof createPujaService>;
