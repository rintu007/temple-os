import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb, rateLimits } from '@templeos/db';
import { createRateLimiter } from './rate-limit.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('rate limiter: fixed-window counters (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const limiter = createRateLimiter({ db });
  const run = `ratelimit${Date.now().toString(36)}`;

  afterAll(async () => {
    await admin.delete(rateLimits).where(sql`${rateLimits.bucketKey} LIKE ${`${run}%`}`);
    await db.$client.end();
    await admin.$client.end();
  });

  it('allows attempts up to the limit, then blocks within the same window', async () => {
    const action = `${run}-login`;
    const identifier = '203.0.113.5';

    const first = await limiter.check(action, identifier, 3, 60);
    expect(first.allowed).toBe(true);
    const second = await limiter.check(action, identifier, 3, 60);
    expect(second.allowed).toBe(true);
    const third = await limiter.check(action, identifier, 3, 60);
    expect(third.allowed).toBe(true);

    const fourth = await limiter.check(action, identifier, 3, 60);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);

    // Still blocked — exceeding the limit doesn't un-count itself.
    const fifth = await limiter.check(action, identifier, 3, 60);
    expect(fifth.allowed).toBe(false);
  });

  it('tracks different identifiers independently under the same action', async () => {
    const action = `${run}-contact`;

    const a = await limiter.check(action, '198.51.100.1', 1, 60);
    expect(a.allowed).toBe(true);
    const aAgain = await limiter.check(action, '198.51.100.1', 1, 60);
    expect(aAgain.allowed).toBe(false);

    // A different identifier under the same action has its own budget.
    const b = await limiter.check(action, '198.51.100.2', 1, 60);
    expect(b.allowed).toBe(true);
  });

  it('resets once the window elapses', async () => {
    const action = `${run}-portal`;
    const identifier = 'devotee@test.invalid';
    // 3s window: wide enough that two sequential DB round trips can't
    // straddle a window boundary by accident (a 1s window flaked here in
    // practice — real network latency between the two awaited calls was
    // occasionally enough to land them in different windows).
    const windowSeconds = 3;

    const first = await limiter.check(action, identifier, 1, windowSeconds);
    expect(first.allowed).toBe(true);
    const blocked = await limiter.check(action, identifier, 1, windowSeconds);
    expect(blocked.allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, windowSeconds * 1000 + 500));

    const afterWindow = await limiter.check(action, identifier, 1, windowSeconds);
    expect(afterWindow.allowed).toBe(true);
  });
});
