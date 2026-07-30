import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  memberships,
  organizations,
  platformAdmins,
  platformSubscriptions,
  roles,
  users,
} from '@templeos/db';
import { systemContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createPlatformService } from './platform.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('platform: cross-tenant ops view (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const platform$ = createPlatformService({ db });

  const run = `plat${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  const staffer = { userId: randomUUID(), email: `staff-${run}@test.invalid`, fullName: 'Staffer' };
  let orgId = '';

  afterAll(async () => {
    await admin.delete(platformAdmins).where(eq(platformAdmins.userId, staffer.userId));
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(platformSubscriptions).where(inArray(platformSubscriptions.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId, staffer.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and a separate platform-admin user', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('platform test'),
      { name: 'Platform Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (!provisioned.ok) return;
    orgId = provisioned.value.id;

    await admin.insert(users).values({
      id: staffer.userId,
      email: staffer.email,
      fullName: staffer.fullName,
    });
    await admin.insert(platformAdmins).values({ userId: staffer.userId, note: 'test grant' });
  });

  it('reports false for an ordinary org owner', async () => {
    expect(await platform$.isPlatformAdmin(owner.userId)).toBe(false);
  });

  it('reports true for a granted platform admin', async () => {
    expect(await platform$.isPlatformAdmin(staffer.userId)).toBe(true);
  });

  it('denies the overview to a non-platform-admin', async () => {
    const result = await platform$.getOverview(owner.userId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('shows the newly-provisioned org in the platform admin overview', async () => {
    const result = await platform$.getOverview(staffer.userId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const org = result.value.organizations.find((o) => o.id === orgId);
    expect(org).toBeDefined();
    expect(org?.plan).toBe('trial');
    expect(org?.subscriptionStatus).toBe('trialing');
    expect(org?.mrrUsd).toBe(0);
    expect(result.value.totalOrganizations).toBeGreaterThan(0);
  });

  it('gets one org detail, denying a non-platform-admin', async () => {
    const denied = await platform$.getOrgDetail(owner.userId, orgId);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');

    const detail = await platform$.getOrgDetail(staffer.userId, orgId);
    expect(detail.ok).toBe(true);
    if (detail.ok) expect(detail.value.name).toBe('Platform Org');
  });

  it('rejects an all-empty override', async () => {
    const result = await platform$.applySubscriptionOverride(staffer.userId, orgId, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('denies an override from a non-platform-admin', async () => {
    const result = await platform$.applySubscriptionOverride(owner.userId, orgId, { plan: 'pro' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('comps a plan and marks the subscription active', async () => {
    const applied = await platform$.applySubscriptionOverride(staffer.userId, orgId, {
      plan: 'pro',
      status: 'active',
    });
    expect(applied.ok).toBe(true);

    const detail = await platform$.getOrgDetail(staffer.userId, orgId);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.value.plan).toBe('pro');
      expect(detail.value.subscriptionStatus).toBe('active');
      expect(detail.value.mrrUsd).toBe(79);
    }
  });

  it('extends the trial forward from the override date, not from scratch', async () => {
    await admin
      .update(platformSubscriptions)
      .set({ plan: 'trial', status: 'trialing', trialEndsAt: new Date(Date.now() + 5 * 86_400_000) })
      .where(eq(platformSubscriptions.organizationId, orgId));

    const applied = await platform$.applySubscriptionOverride(staffer.userId, orgId, {
      extendTrialDays: 14,
    });
    expect(applied.ok).toBe(true);

    const detail = await platform$.getOrgDetail(staffer.userId, orgId);
    expect(detail.ok).toBe(true);
    if (detail.ok && detail.value.trialEndsAt) {
      const daysLeft = (detail.value.trialEndsAt.getTime() - Date.now()) / 86_400_000;
      expect(daysLeft).toBeGreaterThan(18); // ~5 remaining + 14 extended
      expect(daysLeft).toBeLessThan(20);
    }
  });

  it('suspends and reactivates an org, denying a non-platform-admin', async () => {
    const denied = await platform$.setOrganizationStatus(owner.userId, orgId, 'suspended');
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');

    const suspended = await platform$.setOrganizationStatus(staffer.userId, orgId, 'suspended');
    expect(suspended.ok).toBe(true);
    let detail = await platform$.getOrgDetail(staffer.userId, orgId);
    expect(detail.ok && detail.value.orgStatus).toBe('suspended');

    const reactivated = await platform$.setOrganizationStatus(staffer.userId, orgId, 'active');
    expect(reactivated.ok).toBe(true);
    detail = await platform$.getOrgDetail(staffer.userId, orgId);
    expect(detail.ok && detail.value.orgStatus).toBe('active');
  });
});
