import type { Db } from '@templeos/db';
import { createRateLimitRepository } from './rate-limit.repository';

export interface RateLimitCheck {
  allowed: boolean;
  /** Seconds until the current window resets — only meaningful when !allowed. */
  retryAfterSeconds: number;
}

export function createRateLimiter({ db }: { db: Db }) {
  const repo = createRateLimitRepository(db);

  return {
    /**
     * Fixed-window limiter: `identifier` (an IP, an email, whatever the
     * caller wants to bucket by) gets `limit` attempts per `windowSeconds`
     * for a given `action` name. DB-backed rather than in-memory because
     * this runs on stateless serverless instances — an in-process counter
     * would reset per cold start and not be shared across instances.
     */
    async check(action: string, identifier: string, limit: number, windowSeconds: number): Promise<RateLimitCheck> {
      const windowStartSec = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
      const bucketKey = `${action}:${identifier}:${windowStartSec}`;
      const windowExpiresAt = new Date((windowStartSec + windowSeconds) * 1000);

      const count = await repo.increment(bucketKey, windowExpiresAt);

      // Cheap, unscheduled cleanup — expected to run on roughly 1 in 100 calls.
      if (Math.random() < 0.01) {
        await repo.deleteExpired();
      }

      const retryAfterSeconds = Math.max(0, Math.ceil((windowExpiresAt.getTime() - Date.now()) / 1000));
      return { allowed: count <= limit, retryAfterSeconds };
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
