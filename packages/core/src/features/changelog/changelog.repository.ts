import { count, desc, eq, gt } from 'drizzle-orm';
import {
  changelogEntries,
  changelogReads,
  platformAdmins,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { CreateChangelogEntryInput } from '@templeos/validators';
import type { ChangelogEntry } from './changelog.types';

const RECENT_LIMIT = 20;

function toEntry(row: {
  id: string;
  title: string;
  body: string;
  publishedAt: Date;
}): ChangelogEntry {
  return row;
}

export function createChangelogRepository(db: Db) {
  return {
    /** Any signed-in user (RLS: changelog_entries_authenticated_read) — most recent first. */
    async listRecent(userId: string): Promise<ChangelogEntry[]> {
      return withTenantContext(db, { userId }, async (tx) => {
        const rows = await tx
          .select({
            id: changelogEntries.id,
            title: changelogEntries.title,
            body: changelogEntries.body,
            publishedAt: changelogEntries.publishedAt,
          })
          .from(changelogEntries)
          .orderBy(desc(changelogEntries.publishedAt))
          .limit(RECENT_LIMIT);
        return rows.map(toEntry);
      });
    },

    async lastReadAt(userId: string): Promise<Date | null> {
      return withTenantContext(db, { userId }, async (tx) => {
        const [row] = await tx
          .select({ lastReadAt: changelogReads.lastReadAt })
          .from(changelogReads)
          .where(eq(changelogReads.userId, userId))
          .limit(1);
        return row?.lastReadAt ?? null;
      });
    },

    async countUnread(userId: string, since: Date | null): Promise<number> {
      return withTenantContext(db, { userId }, async (tx) => {
        const query = tx.select({ value: count() }).from(changelogEntries);
        const [row] = since === null ? await query : await query.where(gt(changelogEntries.publishedAt, since));
        return row?.value ?? 0;
      });
    },

    async markRead(userId: string): Promise<void> {
      await withTenantContext(db, { userId }, (tx) =>
        tx
          .insert(changelogReads)
          .values({ userId, lastReadAt: new Date() })
          .onConflictDoUpdate({
            target: changelogReads.userId,
            set: { lastReadAt: new Date() },
          }),
      );
    },

    /** Kept local, same as plan.repository.ts#isPlatformAdmin — keeps this feature self-contained. */
    async isPlatformAdmin(userId: string): Promise<boolean> {
      return withTenantContext(db, { userId }, async (tx) => {
        const [row] = await tx
          .select({ userId: platformAdmins.userId })
          .from(platformAdmins)
          .where(eq(platformAdmins.userId, userId))
          .limit(1);
        return row !== undefined;
      });
    },

    async create(actorUserId: string, input: CreateChangelogEntryInput): Promise<ChangelogEntry> {
      return withTenantContext(db, { userId: actorUserId }, async (tx) => {
        const [row] = await tx.insert(changelogEntries).values(input).returning({
          id: changelogEntries.id,
          title: changelogEntries.title,
          body: changelogEntries.body,
          publishedAt: changelogEntries.publishedAt,
        });
        return toEntry(row!);
      });
    },

    /** True if a row existed and was deleted. */
    async remove(actorUserId: string, id: string): Promise<boolean> {
      return withTenantContext(db, { userId: actorUserId }, async (tx) => {
        const rows = await tx
          .delete(changelogEntries)
          .where(eq(changelogEntries.id, id))
          .returning({ id: changelogEntries.id });
        return rows.length > 0;
      });
    },
  };
}

export type ChangelogRepository = ReturnType<typeof createChangelogRepository>;
