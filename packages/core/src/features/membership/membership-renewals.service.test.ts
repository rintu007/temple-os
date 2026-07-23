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
  membershipPlans,
  membershipSubscriptions,
  newId,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDonationService } from '../donations/donation.service';
import { createOrganizationService } from '../organizations/organization.service';
import { addMonths } from './membership.repository';
import { createMembershipService } from './membership.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

/** ISO date `n` days from today (UTC). */
function isoOffset(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!hasDb)('membership renewals: queue + term extension (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createMembershipService({ db });
  const donationSvc = createDonationService({ db });

  const run = `ren${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let planId = '';
  let overdueId = '';
  let dueSoonId = '';
  const today = isoOffset(0);

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(donations).where(inArray(donations.organizationId, [orgId]));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, [orgId]));
      await admin
        .delete(donationCategories)
        .where(inArray(donationCategories.organizationId, [orgId]));
      await admin
        .delete(membershipSubscriptions)
        .where(inArray(membershipSubscriptions.organizationId, [orgId]));
      await admin.delete(membershipPlans).where(inArray(membershipPlans.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up an org, a plan, and two active subscriptions (overdue + due soon)', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('renewals test'),
      { name: 'Renewals Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const plan = await service.createPlan(ctx, {
      name: 'Annual Member',
      price: 1000,
      durationMonths: 12,
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) planId = plan.value.id;

    overdueId = newId();
    dueSoonId = newId();
    await admin.insert(membershipSubscriptions).values([
      {
        id: overdueId,
        organizationId: orgId,
        planId,
        planName: 'Annual Member',
        memberName: 'Lapsed Member',
        amount: '1000.00',
        currency: 'INR',
        startsOn: isoOffset(-375),
        expiresOn: isoOffset(-10),
        status: 'active',
      },
      {
        id: dueSoonId,
        organizationId: orgId,
        planId,
        planName: 'Annual Member',
        memberName: 'Soon Member',
        amount: '1000.00',
        currency: 'INR',
        startsOn: isoOffset(-360),
        expiresOn: isoOffset(5),
        status: 'active',
      },
    ]);
  });

  it('lists both in the renewal queue, overdue first', async () => {
    const result = await service.listRenewals(ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]!.id).toBe(overdueId);
      expect(result.value[0]!.state).toBe('overdue');
      expect(result.value[0]!.daysUntil).toBeLessThan(0);
      expect(result.value[1]!.state).toBe('due_soon');
    }

    const count = await service.countRenewalsDue(ctx);
    expect(count.ok && count.value).toBe(2);
  });

  it('renewing a lapsed member restarts the term from today and issues a receipt', async () => {
    const renewed = await service.renewMembership(ctx, overdueId, { method: 'cash' });
    expect(renewed.ok).toBe(true);
    if (renewed.ok) {
      expect(renewed.value.receiptNumber).toMatch(/^\d{4}-\d{5}$/);
      // Lapsed → term restarts from today.
      expect(renewed.value.subscription.expiresOn).toBe(addMonths(today, 12));
    }

    // The renewal recorded income (default amount = plan price).
    const stats = await donationSvc.getStats(ctx);
    expect(stats.ok && stats.value.monthTotal).toBe('1000.00');
  });

  it('renewing an early member stacks the term onto the current expiry', async () => {
    const currentExpiry = isoOffset(5);
    const renewed = await service.renewMembership(ctx, dueSoonId, { method: 'upi', amount: 1500 });
    expect(renewed.ok).toBe(true);
    if (renewed.ok) {
      // Not lapsed → extend from the existing expiry, not today.
      expect(renewed.value.subscription.expiresOn).toBe(addMonths(currentExpiry, 12));
    }

    // 1000 (first renewal) + 1500 (this one) = 2500 collected.
    const stats = await donationSvc.getStats(ctx);
    expect(stats.ok && stats.value.monthTotal).toBe('2500.00');
  });

  it('empties the queue once both are renewed beyond the window', async () => {
    const count = await service.countRenewalsDue(ctx);
    expect(count.ok && count.value).toBe(0);
  });

  it('rejects a viewer renewal and a cancelled membership', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const forbidden = await service.renewMembership(viewer, overdueId, { method: 'cash' });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.code).toBe('FORBIDDEN');

    await service.cancelMembership(ctx, overdueId);
    const cancelled = await service.renewMembership(ctx, overdueId, { method: 'cash' });
    expect(cancelled.ok).toBe(false);
    if (!cancelled.ok) expect(cancelled.error.code).toBe('CONFLICT');
  });
});
