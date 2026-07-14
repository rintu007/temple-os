import { and, asc, eq, isNull, like } from 'drizzle-orm';
import {
  auditLogs,
  dailySchedules,
  newId,
  organizations,
  temples,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { ScheduleItemInput, TempleInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

const notDeleted = isNull(temples.deletedAt);

export function createTempleRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async list(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select()
          .from(temples)
          .where(and(eq(temples.organizationId, ctx.organizationId), notDeleted))
          .orderBy(asc(temples.createdAt)),
      );
    },

    async findById(ctx: TenantContext, templeId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select()
          .from(temples)
          .where(and(eq(temples.id, templeId), notDeleted))
          .limit(1);
        return row ?? null;
      });
    },

    /** Existing slugs sharing a base — used to pick a unique suffix. */
    async listSlugsLike(ctx: TenantContext, base: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const rows = await tx
          .select({ slug: temples.slug })
          .from(temples)
          .where(and(eq(temples.organizationId, ctx.organizationId), like(temples.slug, `${base}%`)));
        return rows.map((r) => r.slug);
      });
    },

    async create(ctx: TenantContext, input: TempleInput & { slug: string }) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ country: organizations.country })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const [temple] = await tx
          .insert(temples)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            country: org.country,
            name: input.name,
            slug: input.slug,
            deity: input.deity ?? null,
            addressLine1: input.addressLine1 ?? null,
            addressLine2: input.addressLine2 ?? null,
            city: input.city ?? null,
            state: input.state ?? null,
            postalCode: input.postalCode ?? null,
            phone: input.phone ?? null,
            email: input.email ?? null,
          })
          .returning();
        if (!temple) throw new Error('temple insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'temple.created',
          entityType: 'temple',
          entityId: temple.id,
          after: { name: temple.name, slug: temple.slug },
        });
        return temple;
      });
    },

    async update(ctx: TenantContext, templeId: string, input: TempleInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [before] = await tx
          .select()
          .from(temples)
          .where(and(eq(temples.id, templeId), notDeleted))
          .limit(1);
        if (!before) return null;

        const [after] = await tx
          .update(temples)
          .set({
            name: input.name,
            deity: input.deity ?? null,
            addressLine1: input.addressLine1 ?? null,
            addressLine2: input.addressLine2 ?? null,
            city: input.city ?? null,
            state: input.state ?? null,
            postalCode: input.postalCode ?? null,
            phone: input.phone ?? null,
            email: input.email ?? null,
          })
          .where(eq(temples.id, templeId))
          .returning();
        if (!after) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'temple.updated',
          entityType: 'temple',
          entityId: templeId,
          before: { name: before.name, deity: before.deity, city: before.city },
          after: { name: after.name, deity: after.deity, city: after.city },
        });
        return after;
      });
    },

    async listSchedule(ctx: TenantContext, templeId: string) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select()
          .from(dailySchedules)
          .where(and(eq(dailySchedules.templeId, templeId), eq(dailySchedules.isActive, true)))
          .orderBy(asc(dailySchedules.startTime)),
      );
    },

    async addScheduleItem(ctx: TenantContext, templeId: string, input: ScheduleItemInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [item] = await tx
          .insert(dailySchedules)
          .values({
            organizationId: ctx.organizationId,
            templeId,
            title: input.title,
            startTime: input.startTime,
            endTime: input.endTime ?? null,
            description: input.description ?? null,
          })
          .returning();
        if (!item) throw new Error('schedule insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'schedule.item_added',
          entityType: 'daily_schedule',
          entityId: item.id,
          after: { templeId, title: item.title, startTime: item.startTime },
        });
        return item;
      });
    },

    async removeScheduleItem(ctx: TenantContext, itemId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [removed] = await tx
          .delete(dailySchedules)
          .where(eq(dailySchedules.id, itemId))
          .returning();
        if (!removed) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'schedule.item_removed',
          entityType: 'daily_schedule',
          entityId: itemId,
          before: { templeId: removed.templeId, title: removed.title },
        });
        return removed;
      });
    },

    /** Public site read: server-resolved organization id opens the tenant context. */
    async listPublic(organizationId: string) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const templeRows = await tx
          .select()
          .from(temples)
          .where(and(eq(temples.organizationId, organizationId), notDeleted))
          .orderBy(asc(temples.createdAt));

        const scheduleRows = await tx
          .select()
          .from(dailySchedules)
          .where(
            and(
              eq(dailySchedules.organizationId, organizationId),
              eq(dailySchedules.isActive, true),
            ),
          )
          .orderBy(asc(dailySchedules.startTime));

        return { templeRows, scheduleRows };
      });
    },
  };
}

export type TempleRepository = ReturnType<typeof createTempleRepository>;
