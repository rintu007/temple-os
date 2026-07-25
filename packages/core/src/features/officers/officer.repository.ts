import { and, asc, desc, eq } from 'drizzle-orm';
import { auditLogs, newId, officeBearers, withTenantContext, type Db } from '@templeos/db';
import type { OfficeBearerInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

export function createOfficerRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async list(ctx: TenantContext, scope: 'active' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where =
          scope === 'active'
            ? and(
                eq(officeBearers.organizationId, ctx.organizationId),
                eq(officeBearers.isActive, true),
              )
            : eq(officeBearers.organizationId, ctx.organizationId);
        return tx
          .select()
          .from(officeBearers)
          .where(where)
          .orderBy(desc(officeBearers.isActive), asc(officeBearers.createdAt));
      });
    },

    async findById(ctx: TenantContext, officerId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select()
          .from(officeBearers)
          .where(eq(officeBearers.id, officerId))
          .limit(1);
        return row ?? null;
      });
    },

    async create(ctx: TenantContext, input: OfficeBearerInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(officeBearers)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            name: input.name,
            designation: input.designation,
            body: input.body ?? null,
            phone: input.phone ?? null,
            email: input.email ?? null,
            termStartsOn: input.termStartsOn ?? null,
            termEndsOn: input.termEndsOn ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning();
        if (!row) throw new Error('office bearer insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'office_bearer.created',
          entityType: 'office_bearer',
          entityId: row.id,
          after: { name: row.name, designation: row.designation },
        });
        return row;
      });
    },

    async update(ctx: TenantContext, officerId: string, input: OfficeBearerInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(officeBearers)
          .set({
            name: input.name,
            designation: input.designation,
            body: input.body ?? null,
            phone: input.phone ?? null,
            email: input.email ?? null,
            termStartsOn: input.termStartsOn ?? null,
            termEndsOn: input.termEndsOn ?? null,
            note: input.note ?? null,
          })
          .where(eq(officeBearers.id, officerId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'office_bearer.updated',
          entityType: 'office_bearer',
          entityId: officerId,
          after: { name: updated.name, designation: updated.designation },
        });
        return updated;
      });
    },

    /** Ends or reinstates a term. When ending, stamps termEndsOn if unset. */
    async setActive(ctx: TenantContext, officerId: string, isActive: boolean) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [existing] = await tx
          .select()
          .from(officeBearers)
          .where(eq(officeBearers.id, officerId))
          .limit(1);
        if (!existing) return null;

        const termEndsOn =
          !isActive && !existing.termEndsOn
            ? new Date().toISOString().slice(0, 10)
            : isActive
              ? null
              : existing.termEndsOn;

        const [updated] = await tx
          .update(officeBearers)
          .set({ isActive, termEndsOn })
          .where(eq(officeBearers.id, officerId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: isActive ? 'office_bearer.reinstated' : 'office_bearer.ended',
          entityType: 'office_bearer',
          entityId: officerId,
          after: { name: updated.name, isActive },
        });
        return updated;
      });
    },
  };
}

export type OfficerRepository = ReturnType<typeof createOfficerRepository>;
