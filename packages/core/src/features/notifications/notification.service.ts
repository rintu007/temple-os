import type { Db } from '@templeos/db';
import { authorize, ok, type Result, type TenantContext } from '../../shared';
import { createNotificationRepository } from './notification.repository';
import type { NotificationFeed } from './notification.types';

/** 'devotee.created' → 'Devotee created'. */
function humanizeAction(action: string): string {
  const words = action.replace(/[._]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function createNotificationService({ db }: { db: Db }) {
  const repo = createNotificationRepository(db);

  return {
    /**
     * The tray is derived from audit_logs, never a separately-written event
     * table — every mutation across the system already records one there.
     * "Unread" is everything since this user's last-read cursor (or the last
     * 30 days, for a user who has never opened the tray).
     */
    async getFeed(ctx: TenantContext): Promise<Result<NotificationFeed>> {
      const auth = authorize(ctx, 'governance:read');
      if (!auth.ok) return auth;

      const lastReadAt = await repo.lastReadAt(ctx);
      const [items, unreadCount] = await Promise.all([
        repo.listRecent(ctx),
        repo.countUnread(ctx, lastReadAt),
      ]);

      return ok({
        items: items.map((row) => ({
          id: row.id,
          action: row.action,
          title: humanizeAction(row.action),
          entityType: row.entityType,
          entityId: row.entityId,
          actorName: row.actorName,
          createdAt: row.createdAt,
          unread: lastReadAt === null || row.createdAt > lastReadAt,
        })),
        unreadCount,
      });
    },

    async markRead(ctx: TenantContext): Promise<Result<void>> {
      const auth = authorize(ctx, 'governance:read');
      if (!auth.ok) return auth;
      await repo.markRead(ctx);
      return ok(undefined);
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
