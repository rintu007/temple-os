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
});
