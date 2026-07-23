import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  campaigns,
  createDb,
  domains,
  donationCategories,
  donationCounters,
  donations,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDonationService } from '../donations/donation.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createCampaignService } from './campaign.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('campaigns: goals, earmarked donations, progress (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createCampaignService({ db });
  const donationSvc = createDonationService({ db });

  const run = `camp${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let campaignId = '';

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(donations).where(inArray(donations.organizationId, [orgId]));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, [orgId]));
      await admin
        .delete(donationCategories)
        .where(inArray(donationCategories.organizationId, [orgId]));
      await admin.delete(campaigns).where(inArray(campaigns.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up an organization', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('campaign test'),
      { name: 'Campaign Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };
  });

  it('creates a campaign with a goal, starting at zero', async () => {
    const created = await service.createCampaign(ctx, {
      title: 'Temple Renovation Fund',
      description: 'New roof and marble flooring.',
      goalAmount: 200000,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      campaignId = created.value.id;
      expect(created.value.goalAmount).toBe('200000.00');
      expect(created.value.raisedAmount).toBe('0.00');
      expect(created.value.status).toBe('active');
    }
  });

  it('validation rejects a non-positive goal and viewer writes', async () => {
    const bad = await service.createCampaign(ctx, { title: 'Bad', goalAmount: 0 });
    expect(bad.ok).toBe(false);
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const forbidden = await service.createCampaign(viewer, {
      title: 'Nope Campaign',
      goalAmount: 100,
    });
    expect(forbidden.ok).toBe(false);
  });

  it('earmarked donations raise the campaign total; others do not', async () => {
    const toCampaign = await donationSvc.recordDonation(ctx, {
      amount: 50000,
      method: 'cash',
      donorName: 'Big Donor',
      campaignId,
    });
    expect(toCampaign.ok).toBe(true);

    const unrelated = await donationSvc.recordDonation(ctx, {
      amount: 999,
      method: 'cash',
      donorName: 'General Giver',
    });
    expect(unrelated.ok).toBe(true);

    const fetched = await service.getCampaign(ctx, campaignId);
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      expect(fetched.value.raisedAmount).toBe('50000.00');
      expect(fetched.value.donationCount).toBe(1);
    }
  });

  it('public list exposes active campaigns with capped percent', async () => {
    const publicList = await service.listPublicCampaigns(orgId);
    expect(publicList).toHaveLength(1);
    expect(publicList[0]?.title).toBe('Temple Renovation Fund');
    expect(publicList[0]?.percent).toBe(25); // 50000 / 200000
  });

  it('voided donations drop out of the raised total', async () => {
    // record then void a campaign donation
    const extra = await donationSvc.recordDonation(ctx, {
      amount: 20000,
      method: 'cash',
      donorName: 'Change Of Heart',
      campaignId,
    });
    expect(extra.ok).toBe(true);
    if (!extra.ok) return;

    const beforeVoid = await service.getCampaign(ctx, campaignId);
    if (beforeVoid.ok) expect(beforeVoid.value.raisedAmount).toBe('70000.00');

    const voided = await donationSvc.voidDonation(ctx, extra.value.id, { reason: 'refunded' });
    expect(voided.ok).toBe(true);

    const afterVoid = await service.getCampaign(ctx, campaignId);
    if (afterVoid.ok) {
      expect(afterVoid.value.raisedAmount).toBe('50000.00');
      expect(afterVoid.value.donationCount).toBe(1);
    }
  });

  it('completing a campaign removes it from the public list', async () => {
    const done = await service.setCampaignStatus(ctx, campaignId, 'completed');
    expect(done.ok).toBe(true);
    expect(await service.listPublicCampaigns(orgId)).toHaveLength(0);
    // still visible in admin
    const adminList = await service.listCampaigns(ctx);
    expect(adminList.ok).toBe(true);
    if (adminList.ok) expect(adminList.value).toHaveLength(1);
  });
});
