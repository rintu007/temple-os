import { and, asc, count, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import {
  auditLogs,
  devotees,
  families,
  newId,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { DevoteeInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

const notDeleted = isNull(devotees.deletedAt);

function searchFilter(search: string | null | undefined): SQL | undefined {
  if (!search) return undefined;
  const term = `%${search}%`;
  return or(
    ilike(devotees.fullName, term),
    ilike(devotees.email, term),
    ilike(devotees.phone, term),
  );
}

async function findOrCreateFamily(
  tx: Tx,
  organizationId: string,
  familyName: string,
): Promise<string> {
  const [existing] = await tx
    .select({ id: families.id })
    .from(families)
    .where(
      and(
        eq(families.organizationId, organizationId),
        sql`lower(${families.name}) = lower(${familyName})`,
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const [created] = await tx
    .insert(families)
    .values({ id: newId(), organizationId, name: familyName })
    .returning({ id: families.id });
  if (!created) throw new Error('family insert returned no row');
  return created.id;
}

function devoteeValues(input: DevoteeInput) {
  return {
    fullName: input.fullName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    gender: input.gender ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
    addressLine1: input.addressLine1 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postalCode: input.postalCode ?? null,
    notes: input.notes ?? null,
  };
}

export function createDevoteeRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const baseSelect = (tx: Tx) =>
    tx
      .select({
        id: devotees.id,
        fullName: devotees.fullName,
        email: devotees.email,
        phone: devotees.phone,
        gender: devotees.gender,
        dateOfBirth: devotees.dateOfBirth,
        addressLine1: devotees.addressLine1,
        city: devotees.city,
        state: devotees.state,
        postalCode: devotees.postalCode,
        notes: devotees.notes,
        status: devotees.status,
        familyId: devotees.familyId,
        familyName: families.name,
      })
      .from(devotees)
      .leftJoin(families, eq(devotees.familyId, families.id));

  return {
    async list(
      ctx: TenantContext,
      query: { search: string | null; page: number; pageSize: number },
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const where = and(
          eq(devotees.organizationId, ctx.organizationId),
          eq(devotees.status, 'active'),
          notDeleted,
          searchFilter(query.search),
        );

        const [items, [totalRow]] = await Promise.all([
          baseSelect(tx)
            .where(where)
            .orderBy(asc(devotees.fullName))
            .limit(query.pageSize)
            .offset((query.page - 1) * query.pageSize),
          tx.select({ value: count() }).from(devotees).where(where),
        ]);
        return { items, total: totalRow?.value ?? 0 };
      });
    },

    async findById(ctx: TenantContext, devoteeId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx)
          .where(and(eq(devotees.id, devoteeId), notDeleted))
          .limit(1);
        return row ?? null;
      });
    },

    async create(ctx: TenantContext, input: DevoteeInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const familyId = input.familyName
          ? await findOrCreateFamily(tx, ctx.organizationId, input.familyName)
          : null;

        const [devotee] = await tx
          .insert(devotees)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            familyId,
            ...devoteeValues(input),
          })
          .returning();
        if (!devotee) throw new Error('devotee insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'devotee.created',
          entityType: 'devotee',
          entityId: devotee.id,
          after: { fullName: devotee.fullName, phone: devotee.phone },
        });
        return devotee;
      });
    },

    async update(ctx: TenantContext, devoteeId: string, input: DevoteeInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [before] = await tx
          .select()
          .from(devotees)
          .where(and(eq(devotees.id, devoteeId), notDeleted))
          .limit(1);
        if (!before) return null;

        const familyId = input.familyName
          ? await findOrCreateFamily(tx, ctx.organizationId, input.familyName)
          : null;

        const [after] = await tx
          .update(devotees)
          .set({ familyId, ...devoteeValues(input) })
          .where(eq(devotees.id, devoteeId))
          .returning();
        if (!after) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'devotee.updated',
          entityType: 'devotee',
          entityId: devoteeId,
          before: { fullName: before.fullName, phone: before.phone },
          after: { fullName: after.fullName, phone: after.phone },
        });
        return after;
      });
    },

    async setStatus(ctx: TenantContext, devoteeId: string, status: 'active' | 'archived') {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .update(devotees)
          .set({ status })
          .where(and(eq(devotees.id, devoteeId), notDeleted))
          .returning();
        if (!row) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: status === 'archived' ? 'devotee.archived' : 'devotee.restored',
          entityType: 'devotee',
          entityId: devoteeId,
        });
        return row;
      });
    },
  };
}

export type DevoteeRepository = ReturnType<typeof createDevoteeRepository>;
