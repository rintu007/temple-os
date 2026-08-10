import { describe, expect, it } from 'vitest';
import { computePlatformAnalytics } from './platform.analytics';
import type { PlatformOrgSummary } from './platform.types';

const NOW = new Date('2026-06-15T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function org(overrides: Partial<PlatformOrgSummary>): PlatformOrgSummary {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: 'Org',
    slug: 'org',
    country: 'IN',
    orgStatus: 'active',
    createdAt: new Date(NOW.getTime() - 60 * DAY),
    plan: 'trial',
    subscriptionStatus: 'trialing',
    trialEndsAt: null,
    currentPeriodEnd: null,
    isTrialExpired: false,
    mrrUsd: 0,
    ...overrides,
  };
}

describe('computePlatformAnalytics', () => {
  it('returns nulls for conversion/churn when nothing has resolved yet', () => {
    const orgs = [org({ subscriptionStatus: 'trialing', isTrialExpired: false })];
    const result = computePlatformAnalytics(orgs, NOW);
    expect(result.conversionRate).toBeNull();
    expect(result.churnRate).toBeNull();
  });

  it('counts only orgs created within the last 30 days as recent signups', () => {
    const orgs = [
      org({ createdAt: new Date(NOW.getTime() - 5 * DAY) }),
      org({ createdAt: new Date(NOW.getTime() - 29 * DAY) }),
      org({ createdAt: new Date(NOW.getTime() - 31 * DAY) }),
    ];
    expect(computePlatformAnalytics(orgs, NOW).signupsLast30Days).toBe(2);
  });

  it('groups by plan, treating a null plan (legacy org) as "none"', () => {
    const orgs = [org({ plan: 'pro' }), org({ plan: 'pro' }), org({ plan: 'starter' }), org({ plan: null })];
    const result = computePlatformAnalytics(orgs, NOW);
    expect(result.byPlan).toEqual([
      { plan: 'pro', count: 2 },
      { plan: 'starter', count: 1 },
      { plan: 'none', count: 1 },
    ]);
  });

  it('computes conversion rate from resolved trials only, excluding orgs still mid-trial', () => {
    const orgs = [
      org({ subscriptionStatus: 'active' }), // resolved, converted
      org({ subscriptionStatus: 'active' }), // resolved, converted
      org({ subscriptionStatus: 'trialing', isTrialExpired: true }), // resolved, lapsed
      org({ subscriptionStatus: 'trialing', isTrialExpired: false }), // still mid-trial — excluded
    ];
    const result = computePlatformAnalytics(orgs, NOW);
    expect(result.conversionRate).toBeCloseTo(2 / 3);
  });

  it('treats past_due as converted (they did reach paid) for conversion, but not as churn', () => {
    const orgs = [org({ subscriptionStatus: 'past_due' })];
    const result = computePlatformAnalytics(orgs, NOW);
    expect(result.conversionRate).toBe(1);
    expect(result.churnRate).toBe(0);
  });

  it('computes churn rate only among orgs that ever reached a paid status', () => {
    const orgs = [
      org({ subscriptionStatus: 'active' }),
      org({ subscriptionStatus: 'canceled' }),
      org({ subscriptionStatus: 'canceled' }),
      org({ subscriptionStatus: 'trialing', isTrialExpired: false }), // never paid — excluded from churn base
    ];
    const result = computePlatformAnalytics(orgs, NOW);
    expect(result.churnRate).toBeCloseTo(2 / 3);
  });

  it('excludes legacy orgs (null subscriptionStatus) from conversion entirely', () => {
    const orgs = [org({ subscriptionStatus: null, plan: null })];
    const result = computePlatformAnalytics(orgs, NOW);
    expect(result.conversionRate).toBeNull();
    expect(result.churnRate).toBeNull();
  });
});
