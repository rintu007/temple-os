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
  recurringDonations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDonationService } from '../donations/donation.service';
import { createInsightsService } from '../insights/insights.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createRecurringDonationService } from './recurring-donation.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

const todayIso = () => new Date().toISOString().slice(0, 10);

describe.skipIf(!hasDb)('recurring donations: standing gift + derived receipts (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const recurring$ = createRecurringDonationService({ db });
  const donation$ = createDonationService({ db });
  const insights$ = createInsightsService({ db });

  const run = `rdn${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let giftId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, s));
      await admin.delete(donationCategories).where(inArray(donationCategories.organizationId, s));
      await admin.delete(recurringDonations).where(inArray(recurringDonations.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and adds a monthly standing gift', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('recurring donation test'),
      { name: 'Recurring Donation Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await recurring$.createRecurring(ctx, {
      donorName: 'Patron',
      amount: 500,
      frequency: 'monthly',
      startDate: todayIso(), // next due is today
    });
    expect(created.ok).toBe(true);
    if (created.ok) giftId = created.value.id;

    const list = await recurring$.listRecurring(ctx, { scope: 'active' });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const r = list.value.find((x) => x.id === giftId);
    expect(r?.nextDue).toBe(todayIso());
    expect(r?.givenTotal).toBe('0.00');
  });

  it('rejects a standing gift with neither a donor name nor a devotee', async () => {
    const bad = await recurring$.createRecurring(ctx, {
      amount: 100,
      frequency: 'monthly',
      startDate: todayIso(),
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALIDATION');
  });

  it('derives given-to-date from donation receipts tagged to it', async () => {
    const given = await donation$.recordDonation(ctx, {
      donorName: 'Patron',
      amount: 500,
      method: 'upi',
      recurringDonationId: giftId,
      donatedOn: todayIso(),
    });
    expect(given.ok).toBe(true);

    const detail = await recurring$.getDetail(ctx, giftId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.recurring.givenTotal).toBe('500.00');
    expect(detail.value.recurring.lastGivenAt).not.toBeNull();
    expect(detail.value.payments).toHaveLength(1);
    expect(detail.value.payments[0]?.amount).toBe('500.00');
  });

  it('reports a monthly-equivalent commitment across cadences', async () => {
    await recurring$.createRecurring(ctx, {
      donorName: 'Annual Donor',
      amount: 1200,
      frequency: 'annual',
      startDate: todayIso(),
    });
    const stats = await recurring$.getStats(ctx);
    expect(stats.ok).toBe(true);
    if (!stats.ok) return;
    expect(stats.value.activeCount).toBe(2);
    // 500 monthly + 1200/12 annual = 600
    expect(stats.value.monthlyEquivalent).toBe('600.00');
  });

  it('surfaces the due standing gift in insights reminders', async () => {
    const ins = await insights$.getInsights(ctx);
    expect(ins.ok).toBe(true);
    if (!ins.ok) return;
    const reminder = ins.value.reminders.find(
      (r) => r.kind === 'recurring_donation' && r.title === 'Patron',
    );
    expect(reminder).toBeDefined();
    expect(reminder?.amount).toBe('500.00');
  });

  it('pausing clears the next-due date and hides it from active scope', async () => {
    const paused = await recurring$.setStatus(ctx, giftId, 'paused');
    expect(paused.ok).toBe(true);
    const detail = await recurring$.getDetail(ctx, giftId);
    expect(detail.ok && detail.value.recurring.nextDue).toBeNull();
    const active = await recurring$.listRecurring(ctx, { scope: 'active' });
    if (active.ok) expect(active.value.find((x) => x.id === giftId)).toBeUndefined();
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await recurring$.listRecurring(viewer, { scope: 'all' });
    expect(read.ok).toBe(true);

    const write = await recurring$.createRecurring(viewer, {
      donorName: 'X',
      amount: 1,
      frequency: 'monthly',
      startDate: todayIso(),
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
