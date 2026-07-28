import { and, count, desc, eq, gt, isNull, ne, or } from 'drizzle-orm';
import {
  auditLogs,
  memberships,
  notificationReads,
  users,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { TenantContext } from '../../shared';

const RECENT_LIMIT = 30;
/** No read cursor yet — treat anything from the last 30 days as the unread window. */
const DEFAULT_WINDOW_DAYS = 30;

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

/** Excludes the viewer's own actions — a feed of what *others* did. */
function notFromSelf(ctx: TenantContext) {
  return and(
    eq(auditLogs.organizationId, ctx.organizationId),
    or(isNull(auditLogs.actorUserId), ne(auditLogs.actorUserId, ctx.userId)),
  );
}

export function createNotificationRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async lastReadAt(ctx: TenantContext): Promise<Date | null> {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select({ lastReadAt: notificationReads.lastReadAt })
          .from(notificationReads)
          .where(
            and(
              eq(notificationReads.organizationId, ctx.organizationId),
              eq(notificationReads.userId, ctx.userId),
            ),
          )
          .limit(1);
        return row?.lastReadAt ?? null;
      });
    },

    async listRecent(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        selectEntries(tx, ctx.organizationId)
          .where(notFromSelf(ctx))
          .orderBy(desc(auditLogs.createdAt))
          .limit(RECENT_LIMIT),
      );
    },

    async countUnread(ctx: TenantContext, since: Date | null): Promise<number> {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const floor =
          since ?? new Date(Date.now() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const [row] = await tx
          .select({ value: count() })
          .from(auditLogs)
          .where(and(notFromSelf(ctx), gt(auditLogs.createdAt, floor)));
        return row?.value ?? 0;
      });
    },

    async markRead(ctx: TenantContext): Promise<void> {
      await withTenantContext(db, guc(ctx), (tx) =>
        tx
          .insert(notificationReads)
          .values({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            lastReadAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [notificationReads.organizationId, notificationReads.userId],
            set: { lastReadAt: new Date() },
          }),
      );
    },
  };
}

export type NotificationRepository = ReturnType<typeof createNotificationRepository>;
