import { lt, sql } from 'drizzle-orm';
import { rateLimits, withTenantContext, type Db } from '@templeos/db';

export function createRateLimitRepository(db: Db) {
  return {
    /**
     * Atomically bumps (or creates) the counter for one fixed window and
     * returns the count after this attempt. No userId/organizationId — most
     * callers (login, magic-link requests) run before any session exists;
     * see packages/db/sql/0007_rate_limit_policies.sql for why the table
     * itself is openly readable/writable rather than tenant-scoped.
     */
    async increment(bucketKey: string, windowExpiresAt: Date): Promise<number> {
      return withTenantContext(db, {}, async (tx) => {
        const [row] = await tx
          .insert(rateLimits)
          .values({ bucketKey, count: 1, windowExpiresAt })
          .onConflictDoUpdate({
            target: rateLimits.bucketKey,
            set: { count: sql`${rateLimits.count} + 1` },
          })
          .returning({ count: rateLimits.count });
        return row?.count ?? 1;
      });
    },

    /** Opportunistic sweep of expired windows — called probabilistically, not on a schedule, so this stays a self-contained table with no dedicated cron job. */
    async deleteExpired(): Promise<void> {
      await withTenantContext(db, {}, async (tx) => {
        await tx.delete(rateLimits).where(lt(rateLimits.windowExpiresAt, new Date()));
      });
    },
  };
}

export type RateLimitRepository = ReturnType<typeof createRateLimitRepository>;
