import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import {
  auditLogs,
  darshanSlots,
  darshanTokens,
  newId,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { BookDarshanTokenInput, DarshanSlotInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

/** Sum of booked party sizes per slot for an org, as a Map. */
async function bookedBySlot(tx: Tx, organizationId: string): Promise<Map<string, number>> {
  const rows = await tx
    .select({
      slotId: darshanTokens.slotId,
      booked: sql<string>`coalesce(sum(${darshanTokens.partySize}), 0)`,
    })
    .from(darshanTokens)
    .where(
      and(
        eq(darshanTokens.organizationId, organizationId),
        eq(darshanTokens.status, 'booked'),
      ),
    )
    .groupBy(darshanTokens.slotId);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.slotId, Number(r.booked));
  return map;
}

export function createDarshanRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async listSlots(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [rows, booked] = await Promise.all([
          tx
            .select()
            .from(darshanSlots)
            .where(eq(darshanSlots.organizationId, ctx.organizationId))
            .orderBy(desc(darshanSlots.slotDate), asc(darshanSlots.startTime)),
          bookedBySlot(tx, ctx.organizationId),
        ]);
        return rows.map((s) => ({ ...s, booked: booked.get(s.id) ?? 0 }));
      });
    },

    async createSlot(ctx: TenantContext, input: DarshanSlotInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(darshanSlots)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            name: input.name,
            slotDate: input.slotDate,
            startTime: input.startTime,
            endTime: input.endTime ?? null,
            capacity: input.capacity,
            note: input.note ?? null,
          })
          .returning();
        if (!row) throw new Error('darshan slot insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'darshan_slot.created',
          entityType: 'darshan_slot',
          entityId: row.id,
          after: { name: row.name, slotDate: row.slotDate, capacity: row.capacity },
        });
        return { ...row, booked: 0 };
      });
    },

    async setSlotActive(ctx: TenantContext, slotId: string, isActive: boolean) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(darshanSlots)
          .set({ isActive })
          .where(eq(darshanSlots.id, slotId))
          .returning();
        return updated ?? null;
      });
    },

    async findSlot(ctx: TenantContext, slotId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select()
          .from(darshanSlots)
          .where(eq(darshanSlots.id, slotId))
          .limit(1);
        if (!row) return null;
        const [agg] = await tx
          .select({ booked: sql<string>`coalesce(sum(${darshanTokens.partySize}), 0)` })
          .from(darshanTokens)
          .where(and(eq(darshanTokens.slotId, slotId), eq(darshanTokens.status, 'booked')));
        return { ...row, booked: Number(agg?.booked ?? 0) };
      });
    },

    async listTokens(ctx: TenantContext, slotId: string) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select()
          .from(darshanTokens)
          .where(
            and(
              eq(darshanTokens.organizationId, ctx.organizationId),
              eq(darshanTokens.slotId, slotId),
            ),
          )
          .orderBy(asc(darshanTokens.tokenNumber)),
      );
    },

    async setTokenStatus(
      ctx: TenantContext,
      tokenId: string,
      status: 'used' | 'cancelled',
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(darshanTokens)
          .set({ status })
          .where(eq(darshanTokens.id, tokenId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: `darshan_token.${status}`,
          entityType: 'darshan_token',
          entityId: tokenId,
          after: { tokenNumber: updated.tokenNumber },
        });
        return updated;
      });
    },

    // ---- Public flow ----
    async listActiveSlots(organizationId: string, todayIso: string) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [rows, booked] = await Promise.all([
          tx
            .select()
            .from(darshanSlots)
            .where(
              and(
                eq(darshanSlots.organizationId, organizationId),
                eq(darshanSlots.isActive, true),
                gte(darshanSlots.slotDate, todayIso),
              ),
            )
            .orderBy(asc(darshanSlots.slotDate), asc(darshanSlots.startTime)),
          bookedBySlot(tx, organizationId),
        ]);
        return rows.map((s) => ({ ...s, booked: booked.get(s.id) ?? 0 }));
      });
    },

    /**
     * Books a token. Locks the slot row FOR UPDATE so concurrent bookings
     * serialize — the capacity check and the sequential token number are both
     * computed under the lock, making overbooking and number collisions
     * impossible without any unique-index abort risk.
     */
    async bookToken(organizationId: string, input: BookDarshanTokenInput, todayIso: string) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [slot] = await tx
          .select()
          .from(darshanSlots)
          .where(
            and(eq(darshanSlots.id, input.slotId), eq(darshanSlots.organizationId, organizationId)),
          )
          .for('update')
          .limit(1);
        if (!slot || !slot.isActive) return { kind: 'not_found' as const };
        if (slot.slotDate < todayIso) return { kind: 'closed' as const };

        const [agg] = await tx
          .select({
            booked: sql<string>`coalesce(sum(${darshanTokens.partySize}), 0)`,
            maxNumber: sql<string>`coalesce(max(${darshanTokens.tokenNumber}), 0)`,
          })
          .from(darshanTokens)
          .where(and(eq(darshanTokens.slotId, slot.id), eq(darshanTokens.status, 'booked')));
        const booked = Number(agg?.booked ?? 0);
        if (booked + input.partySize > slot.capacity) {
          return { kind: 'full' as const, remaining: Math.max(0, slot.capacity - booked) };
        }

        // Sequential number across all tokens ever issued for the slot.
        const [maxAll] = await tx
          .select({ maxNumber: sql<string>`coalesce(max(${darshanTokens.tokenNumber}), 0)` })
          .from(darshanTokens)
          .where(eq(darshanTokens.slotId, slot.id));
        const tokenNumber = Number(maxAll?.maxNumber ?? 0) + 1;

        const [token] = await tx
          .insert(darshanTokens)
          .values({
            id: newId(),
            organizationId,
            slotId: slot.id,
            tokenNumber,
            devoteeName: input.devoteeName,
            phone: input.phone,
            email: input.email ?? null,
            partySize: input.partySize,
            note: input.note ?? null,
          })
          .returning();
        if (!token) throw new Error('darshan token insert returned no row');

        return { kind: 'ok' as const, token, slot };
      });
    },
  };
}

export type DarshanRepository = ReturnType<typeof createDarshanRepository>;
