import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  donationCategories,
  donationCounters,
  donations,
  memberships,
  organizations,
  prasadamSessions,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDonationService } from '../donations/donation.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createPrasadamService } from './prasadam.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('prasadam: serving log + sponsorship ledger post (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createPrasadamService({ db });
  const donationSvc = createDonationService({ db });

  const run = `pra${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(prasadamSessions).where(inArray(prasadamSessions.organizationId, [orgId]));
      await admin.delete(donations).where(inArray(donations.organizationId, [orgId]));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, [orgId]));
      await admin
        .delete(donationCategories)
        .where(inArray(donationCategories.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an organization', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('prasadam test'),
      { name: 'Prasadam Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };
  });

  it('records a plain serving with no sponsorship', async () => {
    const result = await service.recordSession(ctx, { meal: 'lunch', servedCount: 250 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.servedCount).toBe(250);
      expect(result.value.sponsorAmount).toBeNull();
    }
  });

  it('records a sponsored serving and posts the sponsorship to the ledger', async () => {
    const result = await service.recordSession(ctx, {
      meal: 'breakfast',
      servedCount: 100,
      sponsorName: 'Sharma Family',
      sponsorAmount: 5000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sponsorAmount).toBe('5000.00');
      expect(result.value.sponsorName).toBe('Sharma Family');
    }

    const stats = await donationSvc.getStats(ctx);
    expect(stats.ok).toBe(true);
    if (stats.ok) {
      expect(stats.value.monthCount).toBe(1);
      expect(stats.value.monthTotal).toBe('5000.00');
    }
  });

  it('lists sessions and aggregates the counts', async () => {
    const list = await service.listSessions(ctx);
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.value).toHaveLength(2);

    const stats = await service.getStats(ctx);
    expect(stats.ok).toBe(true);
    if (stats.ok) {
      expect(stats.value.todayMeals).toBe(350);
      expect(stats.value.monthMeals).toBe(350);
      expect(stats.value.monthSessions).toBe(2);
    }
  });

  it('rejects an empty count and a viewer write', async () => {
    const bad = await service.recordSession(ctx, { meal: 'lunch', servedCount: 0 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALIDATION');

    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const forbidden = await service.recordSession(viewer, { meal: 'lunch', servedCount: 50 });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.code).toBe('FORBIDDEN');
  });
});
