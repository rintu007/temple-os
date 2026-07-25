import { and, count, desc, eq, gte, sql, type SQL } from 'drizzle-orm';
import { auditLogs, memberships, users, withTenantContext, type Db, type Tx } from '@templeos/db';
import type { TenantContext } from '../../shared';
import type { ActivityFilters } from './audit.types';

function buildWhere(organizationId: string, filters: ActivityFilters): SQL | undefined {
  const clauses: SQL[] = [eq(auditLogs.organizationId, organizationId)];
  if (filters.entityType) clauses.push(eq(auditLogs.entityType, filters.entityType));
  if (filters.from) clauses.push(gte(auditLogs.createdAt, new Date(`${filters.from}T00:00:00`)));
  if (filters.to) {
    clauses.push(
      sql`${auditLogs.createdAt} < ${new Date(`${filters.to}T00:00:00`)}::timestamptz + interval '1 day'`,
    );
  }
  return and(...clauses);
}

/** Actor names resolved through org memberships — RLS-safe, like the team roster. */
function selectEntries(tx: Tx, organizationId: string) {
  return tx
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      actorName: users.fullName,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(
      memberships,
      and(
        eq(memberships.userId, auditLogs.actorUserId),
        eq(memberships.organizationId, organizationId),
      ),
    )
    .leftJoin(users, eq(users.id, memberships.userId));
}

export function createAuditRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async list(
      ctx: TenantContext,
      filters: ActivityFilters,
      page: number,
      pageSize: number,
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const where = buildWhere(ctx.organizationId, filters);
        const [items, [totalRow]] = await Promise.all([
          selectEntries(tx, ctx.organizationId)
            .where(where)
            .orderBy(desc(auditLogs.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize),
          tx.select({ value: count() }).from(auditLogs).where(where),
        ]);
        return { items, total: totalRow?.value ?? 0 };
      });
    },

    async exportRows(ctx: TenantContext, filters: ActivityFilters) {
      return withTenantContext(db, guc(ctx), (tx) =>
        selectEntries(tx, ctx.organizationId)
          .where(buildWhere(ctx.organizationId, filters))
          .orderBy(desc(auditLogs.createdAt))
          .limit(10000),
      );
    },

    /** Distinct entity types present for this org — powers the filter dropdown. */
    async entityTypes(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const rows = await tx
          .selectDistinct({ entityType: auditLogs.entityType })
          .from(auditLogs)
          .where(eq(auditLogs.organizationId, ctx.organizationId))
          .orderBy(auditLogs.entityType);
        return rows.map((r) => r.entityType);
      });
    },
  };
}

export type AuditRepository = ReturnType<typeof createAuditRepository>;
