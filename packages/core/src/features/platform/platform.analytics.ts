import type { PlatformOrgSummary } from './platform.types';

export interface PlatformAnalytics {
  signupsLast30Days: number;
  byPlan: Array<{ plan: string; count: number }>;
  /** Share of orgs whose trial has run its course (converted or lapsed) that converted to paid. Null if none have finished their trial yet. */
  conversionRate: number | null;
  /** Share of orgs that ever reached a paid status that have since canceled. Null if none have ever been paid. */
  churnRate: number | null;
}

/**
 * Derived entirely from data already fetched for the platform overview — no
 * new query, no event log. This is a current-snapshot approximation (e.g.
 * "conversion rate" reflects orgs' status right now, not a true signup-date
 * cohort over time), not a substitute for a real analytics/event pipeline —
 * see the "Product analytics" line in docs/SAAS-LAUNCH-PLAN.md for that gap.
 */
export function computePlatformAnalytics(
  orgs: readonly PlatformOrgSummary[],
  now: Date = new Date(),
): PlatformAnalytics {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const signupsLast30Days = orgs.filter(
    (o) => now.getTime() - o.createdAt.getTime() <= THIRTY_DAYS_MS,
  ).length;

  const byPlanCounts = new Map<string, number>();
  for (const o of orgs) {
    const key = o.plan ?? 'none';
    byPlanCounts.set(key, (byPlanCounts.get(key) ?? 0) + 1);
  }
  const byPlan = [...byPlanCounts.entries()]
    .map(([plan, count]) => ({ plan, count }))
    .sort((a, b) => b.count - a.count);

  // "Resolved" = no longer actively mid-trial: converted, past_due, canceled, or trialing-but-expired.
  const resolved = orgs.filter(
    (o) => o.subscriptionStatus !== null && (o.subscriptionStatus !== 'trialing' || o.isTrialExpired),
  );
  const converted = resolved.filter(
    (o) => o.subscriptionStatus === 'active' || o.subscriptionStatus === 'past_due',
  );
  const conversionRate = resolved.length > 0 ? converted.length / resolved.length : null;

  const everPaid = orgs.filter(
    (o) =>
      o.subscriptionStatus === 'active' ||
      o.subscriptionStatus === 'past_due' ||
      o.subscriptionStatus === 'canceled',
  );
  const canceled = orgs.filter((o) => o.subscriptionStatus === 'canceled');
  const churnRate = everPaid.length > 0 ? canceled.length / everPaid.length : null;

  return { signupsLast30Days, byPlan, conversionRate, churnRate };
}
