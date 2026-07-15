import { and, asc, count, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { auditLogs, events, newId, withTenantContext, type Db, type Tx } from '@templeos/db';
import type { TenantContext } from '../../shared';

const notDeleted = isNull(events.deletedAt);
const effectiveEnd = sql`coalesce(${events.endsAt}, ${events.startsAt})`;

export interface EventWriteValues {
  kind: 'event' | 'festival';
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  isPublished: boolean;
}

export function createEventRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const scopeFilter = (scope: 'upcoming' | 'past') =>
    scope === 'upcoming' ? gte(effectiveEnd, sql`now()`) : lt(effectiveEnd, sql`now()`);

  return {
    async list(
      ctx: TenantContext,
      query: { scope: 'upcoming' | 'past'; page: number; pageSize: number },
    ) {
      return withTenantContext(db, guc(ctx), async (tx: Tx) => {
        const where = and(
          eq(events.organizationId, ctx.organizationId),
          notDeleted,
          scopeFilter(query.scope),
        );
        const [items, [totalRow]] = await Promise.all([
          tx
            .select()
            .from(events)
            .where(where)
            .orderBy(query.scope === 'upcoming' ? asc(events.startsAt) : desc(events.startsAt))
            .limit(query.pageSize)
            .offset((query.page - 1) * query.pageSize),
          tx.select({ value: count() }).from(events).where(where),
        ]);
        return { items, total: totalRow?.value ?? 0 };
      });
    },

    async findById(ctx: TenantContext, eventId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select()
          .from(events)
          .where(and(eq(events.id, eventId), notDeleted))
          .limit(1);
        return row ?? null;
      });
    },

    async create(ctx: TenantContext, values: EventWriteValues) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [event] = await tx
          .insert(events)
          .values({ id: newId(), organizationId: ctx.organizationId, ...values })
          .returning();
        if (!event) throw new Error('event insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'event.created',
          entityType: 'event',
          entityId: event.id,
          after: { title: event.title, kind: event.kind, startsAt: event.startsAt.toISOString() },
        });
        return event;
      });
    },

    async update(ctx: TenantContext, eventId: string, values: EventWriteValues) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [before] = await tx
          .select()
          .from(events)
          .where(and(eq(events.id, eventId), notDeleted))
          .limit(1);
        if (!before) return null;

        const [after] = await tx
          .update(events)
          .set(values)
          .where(eq(events.id, eventId))
          .returning();
        if (!after) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'event.updated',
          entityType: 'event',
          entityId: eventId,
          before: { title: before.title, startsAt: before.startsAt.toISOString() },
          after: { title: after.title, startsAt: after.startsAt.toISOString() },
        });
        return after;
      });
    },

    async remove(ctx: TenantContext, eventId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [removed] = await tx
          .update(events)
          .set({ deletedAt: new Date() })
          .where(and(eq(events.id, eventId), notDeleted))
          .returning();
        if (!removed) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'event.deleted',
          entityType: 'event',
          entityId: eventId,
          before: { title: removed.title },
        });
        return removed;
      });
    },

    /** Public site: published upcoming events, soonest first. */
    async publicUpcoming(organizationId: string, limit: number) {
      return withTenantContext(db, { organizationId }, (tx) =>
        tx
          .select()
          .from(events)
          .where(
            and(
              eq(events.organizationId, organizationId),
              eq(events.isPublished, true),
              notDeleted,
              gte(effectiveEnd, sql`now()`),
            ),
          )
          .orderBy(asc(events.startsAt))
          .limit(limit),
      );
    },
  };
}

export type EventRepository = ReturnType<typeof createEventRepository>;
