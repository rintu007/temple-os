import { headers } from 'next/headers';
import { createRateLimiter, type RateLimitCheck } from '@templeos/core';
import { getDb } from '@templeos/db';

let _rateLimiter: ReturnType<typeof createRateLimiter> | undefined;
function rateLimiter() {
  _rateLimiter ??= createRateLimiter({ db: getDb() });
  return _rateLimiter;
}

/** Best-effort caller IP from Vercel's forwarding header — Server Actions get no raw Request to read directly. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

export async function checkRateLimit(
  action: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitCheck> {
  return rateLimiter().check(action, identifier, limit, windowSeconds);
}
