import type { Db } from '@templeos/db';
import { createChangelogEntrySchema } from '@templeos/validators';
import { domainError, err, forbidden, notFound, ok, type Result } from '../../shared';
import { createChangelogRepository } from './changelog.repository';
import type { ChangelogEntry, ChangelogFeed } from './changelog.types';

export function createChangelogService({ db }: { db: Db }) {
  const repo = createChangelogRepository(db);

  return {
    /** Any signed-in user — "unread" is everything since this user's last-read cursor. */
    async getFeed(userId: string): Promise<ChangelogFeed> {
      const lastReadAt = await repo.lastReadAt(userId);
      const [items, unreadCount] = await Promise.all([
        repo.listRecent(userId),
        repo.countUnread(userId, lastReadAt),
      ]);

      return {
        items: items.map((entry) => ({
          ...entry,
          unread: lastReadAt === null || entry.publishedAt > lastReadAt,
        })),
        unreadCount,
      };
    },

    async markRead(userId: string): Promise<void> {
      await repo.markRead(userId);
    },

    async createEntry(
      actorUserId: string,
      rawInput: unknown,
    ): Promise<Result<ChangelogEntry>> {
      if (!(await repo.isPlatformAdmin(actorUserId))) {
        return err(forbidden('Platform admin access required'));
      }
      const parsed = createChangelogEntrySchema.safeParse(rawInput);
      if (!parsed.success) {
        return err(domainError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid input'));
      }
      const row = await repo.create(actorUserId, parsed.data);
      return ok(row);
    },

    async deleteEntry(actorUserId: string, id: string): Promise<Result<null>> {
      if (!(await repo.isPlatformAdmin(actorUserId))) {
        return err(forbidden('Platform admin access required'));
      }
      const removed = await repo.remove(actorUserId, id);
      if (!removed) return err(notFound('Changelog entry'));
      return ok(null);
    },
  };
}

export type ChangelogService = ReturnType<typeof createChangelogService>;
