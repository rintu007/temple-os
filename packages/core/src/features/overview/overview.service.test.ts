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
  expenseCategories,
  expenseCounters,
  expenses,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createCampaignService } from '../campaigns/campaign.service';
import { createDonationService } from '../donations/donation.service';
import { createExpenseService } from '../expenses/expense.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createOverviewService } from './overview.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('overview: command-center aggregation (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const overview = createOverviewService({ db });
  const donationSvc = createDonationService({ db });
  const expenseSvc = createExpenseService({ db });
  const campaignSvc = createCampaignService({ db });

  const run = `ovw${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(donations).where(inArray(donations.organizationId, [orgId]));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, [orgId]));
      await admin
        .delete(donationCategories)
        .where(inArray(donationCategories.organizationId, [orgId]));
      await admin.delete(expenses).where(inArray(expenses.organizationId, [orgId]));
      await admin.delete(expenseCounters).where(inArray(expenseCounters.organizationId, [orgId]));
      await admin
        .delete(expenseCategories)
        .where(inArray(expenseCategories.organizationId, [orgId]));
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

  it('provisions an org and seeds donations, an expense and a campaign', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('overview test'),
      { name: 'Overview Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const campaign = await campaignSvc.createCampaign(ctx, {
      title: 'Annadanam Fund',
      goalAmount: 100000,
    });
    expect(campaign.ok).toBe(true);
    const campaignId = campaign.ok ? campaign.value.id : '';

    const d1 = await donationSvc.recordDonation(ctx, {
      amount: 5000,
      method: 'cash',
      donorName: 'Devotee One',
      campaignId,
    });
    const d2 = await donationSvc.recordDonation(ctx, {
      amount: 2500,
      method: 'upi',
      donorName: 'Devotee Two',
    });
    expect(d1.ok && d2.ok).toBe(true);

    const e1 = await expenseSvc.recordExpense(ctx, {
      amount: 1500,
      method: 'cash',
      paidTo: 'Flower Vendor',
      categoryName: 'Puja Supplies',
    });
    expect(e1.ok).toBe(true);
  });

  it('aggregates the month totals, net position and all-time received', async () => {
    const result = await overview.getOverview(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const o = result.value;

    expect(o.currency).toBe('INR');
    expect(o.donations.monthCount).toBe(2);
    expect(o.donations.monthTotal).toBe('7500.00');
    expect(o.donations.allTimeTotal).toBe('7500.00');
    expect(o.expenses.monthCount).toBe(1);
    expect(o.expenses.monthTotal).toBe('1500.00');
    // 7500 received − 1500 spent = 6000 net.
    expect(o.netThisMonth).toBe('6000.00');
  });

  it('returns a six-month trend with this month populated', async () => {
    const result = await overview.getOverview(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { trend } = result.value;

    expect(trend).toHaveLength(6);
    const current = trend[trend.length - 1]!;
    expect(current.donations).toBe('7500.00');
    expect(current.expenses).toBe('1500.00');
    // Earliest bucket has no seeded data.
    expect(trend[0]!.donations).toBe('0.00');
  });

  it('surfaces the active campaign with its live raised total', async () => {
    const result = await overview.getOverview(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { campaigns: cs } = result.value;

    expect(cs).toHaveLength(1);
    expect(cs[0]!.title).toBe('Annadanam Fund');
    expect(cs[0]!.goalAmount).toBe('100000.00');
    // Only the earmarked 5000 counts toward the campaign.
    expect(cs[0]!.raisedAmount).toBe('5000.00');
    expect(cs[0]!.donationCount).toBe(1);
  });

  it('records recent activity and denies a role without overview access', async () => {
    const result = await overview.getOverview(ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.activity.length).toBeGreaterThan(0);
    }

    const stranger: TenantContext = { ...ctx, roleKey: 'no_such_role' };
    const denied = await overview.getOverview(stranger);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');
  });
});
