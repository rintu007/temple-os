import type { Db } from '@templeos/db';
import { bookDarshanTokenSchema, darshanSlotSchema } from '@templeos/validators';
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
import { createDarshanRepository } from './darshan.repository';
import type {
  BookedDarshanToken,
  DarshanSlotSummary,
  DarshanTokenSummary,
  PublicDarshanSlot,
} from './darshan.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface SlotRow {
  id: string;
  name: string;
  slotDate: string;
  startTime: string;
  endTime: string | null;
  capacity: number;
  note: string | null;
  isActive: boolean;
  booked: number;
  createdAt: Date;
}

function toSlotSummary(s: SlotRow): DarshanSlotSummary {
  return {
    id: s.id,
    name: s.name,
    slotDate: s.slotDate,
    startTime: s.startTime,
    endTime: s.endTime,
    capacity: s.capacity,
    note: s.note,
    isActive: s.isActive,
    booked: s.booked,
    remaining: Math.max(0, s.capacity - s.booked),
    createdAt: s.createdAt,
  };
}

function toTokenSummary(t: {
  id: string;
  tokenNumber: number;
  devoteeName: string;
  phone: string | null;
  email: string | null;
  partySize: number;
  status: 'booked' | 'used' | 'cancelled';
  note: string | null;
  createdAt: Date;
}): DarshanTokenSummary {
  return {
    id: t.id,
    tokenNumber: t.tokenNumber,
    devoteeName: t.devoteeName,
    phone: t.phone,
    email: t.email,
    partySize: t.partySize,
    status: t.status,
    note: t.note,
    createdAt: t.createdAt,
  };
}

export function createDarshanService({ db }: { db: Db }) {
  const repo = createDarshanRepository(db);

  return {
    // ---- Admin ----
    async listSlots(ctx: TenantContext): Promise<Result<DarshanSlotSummary[]>> {
      const auth = authorize(ctx, 'darshan:read');
      if (!auth.ok) return auth;
      const rows = await repo.listSlots(ctx);
      return ok(rows.map(toSlotSummary));
    },

    async createSlot(ctx: TenantContext, rawInput: unknown): Promise<Result<DarshanSlotSummary>> {
      const auth = authorize(ctx, 'darshan:write');
      if (!auth.ok) return auth;
      const parsed = darshanSlotSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const row = await repo.createSlot(ctx, parsed.data);
      return ok(toSlotSummary(row));
    },

    async setSlotActive(
      ctx: TenantContext,
      slotId: string,
      isActive: boolean,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'darshan:write');
      if (!auth.ok) return auth;
      const updated = await repo.setSlotActive(ctx, slotId, isActive);
      if (!updated) return err(notFound('Darshan slot'));
      return ok(null);
    },

    async getSlot(ctx: TenantContext, slotId: string): Promise<Result<DarshanSlotSummary>> {
      const auth = authorize(ctx, 'darshan:read');
      if (!auth.ok) return auth;
      const row = await repo.findSlot(ctx, slotId);
      if (!row) return err(notFound('Darshan slot'));
      return ok(toSlotSummary(row));
    },

    async listTokens(
      ctx: TenantContext,
      slotId: string,
    ): Promise<Result<DarshanTokenSummary[]>> {
      const auth = authorize(ctx, 'darshan:read');
      if (!auth.ok) return auth;
      const rows = await repo.listTokens(ctx, slotId);
      return ok(rows.map(toTokenSummary));
    },

    async markTokenUsed(ctx: TenantContext, tokenId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'darshan:write');
      if (!auth.ok) return auth;
      const updated = await repo.setTokenStatus(ctx, tokenId, 'used');
      if (!updated) return err(notFound('Token'));
      return ok(null);
    },

    async cancelToken(ctx: TenantContext, tokenId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'darshan:write');
      if (!auth.ok) return auth;
      const updated = await repo.setTokenStatus(ctx, tokenId, 'cancelled');
      if (!updated) return err(notFound('Token'));
      return ok(null);
    },

    // ---- Public ----
    async listPublicSlots(organizationId: string): Promise<PublicDarshanSlot[]> {
      const rows = await repo.listActiveSlots(organizationId, todayIso());
      return rows.map((s) => ({
        id: s.id,
        name: s.name,
        slotDate: s.slotDate,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: s.capacity,
        remaining: Math.max(0, s.capacity - s.booked),
      }));
    },

    async bookToken(
      organizationId: string,
      rawInput: unknown,
    ): Promise<Result<BookedDarshanToken>> {
      const parsed = bookDarshanTokenSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const result = await repo.bookToken(organizationId, parsed.data, todayIso());
      if (result.kind === 'not_found') return err(notFound('Darshan slot'));
      if (result.kind === 'closed') {
        return err(domainError('VALIDATION', 'Booking for this darshan slot has closed'));
      }
      if (result.kind === 'full') {
        return err(
          conflict(
            result.remaining > 0
              ? `Only ${result.remaining} place${result.remaining === 1 ? '' : 's'} left in this slot`
              : 'This darshan slot is full',
          ),
        );
      }
      return ok({
        tokenNumber: result.token.tokenNumber,
        slotName: result.slot.name,
        slotDate: result.slot.slotDate,
        startTime: result.slot.startTime,
        partySize: result.token.partySize,
      });
    },
  };
}

export type DarshanService = ReturnType<typeof createDarshanService>;
