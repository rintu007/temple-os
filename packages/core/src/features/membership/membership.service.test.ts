import { createHmac, randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  donationCategories,
  donationCounters,
  donations,
  membershipPlans,
  membershipSubscriptions,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { razorpayFromEnv } from '../payments/razorpay';
import { addMonths } from './membership.repository';
import { createMembershipService } from './membership.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);
const hasRazorpay = razorpayFromEnv() !== null;

describe('addMonths', () => {
  it('adds months with overflow handling', () => {
    expect(addMonths('2026-01-15', 12)).toBe('2027-01-15');
    expect(addMonths('2026-01-31', 1)).toBe('2026-03-03'); // Feb overflow → early March
    expect(addMonths('2026-11-30', 3)).toBe('2027-03-02'); // Feb 30 overflow → Mar 2
    expect(addMonths('2026-07-22', 6)).toBe('2027-01-22');
  });
});

describe.skipIf(!hasDb || !hasRazorpay)(
  'membership: plans, join, expiry, isolation (live Razorpay + db)',
  () => {
    const db = createDb();
    const admin = createDb(process.env.DATABASE_URL_ADMIN);
    const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
    const service = createMembershipService({ db });
    const secret = process.env.RAZORPAY_KEY_SECRET!;

    const run = `mem${Date.now().toString(36)}`;
    const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
    let orgId = '';
    let otherOrgId = '';
    let planId = '';
    let orderId = '';

    const ctx = (roleKey = 'owner'): TenantContext => ({
      organizationId: orgId,
      userId: owner.userId,
      roleKey,
      templeIds: null,
    });

    afterAll(async () => {
      const orgIds = [orgId, otherOrgId].filter(Boolean);
      if (orgIds.length > 0) {
        await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, orgIds));
        await admin
          .delete(membershipSubscriptions)
          .where(inArray(membershipSubscriptions.organizationId, orgIds));
        await admin
          .delete(membershipPlans)
          .where(inArray(membershipPlans.organizationId, orgIds));
        await admin.delete(donations).where(inArray(donations.organizationId, orgIds));
        await admin
          .delete(donationCounters)
          .where(inArray(donationCounters.organizationId, orgIds));
        await admin
          .delete(donationCategories)
          .where(inArray(donationCategories.organizationId, orgIds));
        await admin.delete(memberships).where(inArray(memberships.organizationId, orgIds));
        await admin.delete(roles).where(inArray(roles.organizationId, orgIds));
        await admin.delete(domains).where(inArray(domains.organizationId, orgIds));
        await admin.delete(organizations).where(inArray(organizations.id, orgIds));
      }
      await admin.delete(users).where(inArray(users.id, [owner.userId]));
      await db.$client.end();
      await admin.$client.end();
    });

    it('sets up organizations', async () => {
      const a = await orgService.provisionOrganization(
        systemContext('membership test'),
        { name: 'Membership Org', slug: `${run}-main`, country: 'IN' },
        owner,
      );
      expect(a.ok).toBe(true);
      if (a.ok) orgId = a.value.id;

      const b = await orgService.provisionOrganization(
        systemContext('membership test'),
        { name: 'Other Org', slug: `${run}-other`, country: 'BD' },
        { userId: randomUUID(), email: `out-${run}@test.invalid` },
      );
      expect(b.ok).toBe(true);
      if (b.ok) otherOrgId = b.value.id;
    });

    it('manages plans; viewer denied writes; inactive plans hidden publicly', async () => {
      const created = await service.createPlan(ctx(), {
        name: 'Annual Member',
        description: 'One year of membership benefits',
        price: 2100,
        durationMonths: 12,
      });
      expect(created.ok).toBe(true);
      if (created.ok) {
        planId = created.value.id;
        expect(created.value.price).toBe('2100.00');
        expect(created.value.currency).toBe('INR');
        expect(created.value.durationMonths).toBe(12);
      }

      const denied = await service.createPlan({ ...ctx(), roleKey: 'viewer' }, {
        name: 'Nope',
        price: 100,
        durationMonths: 1,
      });
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');

      const hidden = await service.createPlan(ctx(), {
        name: 'Hidden Plan',
        price: 500,
        durationMonths: 6,
        isActive: false,
      });
      expect(hidden.ok).toBe(true);

      const publicPlans = await service.listPublicPlans(orgId);
      expect(publicPlans.map((p) => p.name)).toContain('Annual Member');
      expect(publicPlans.map((p) => p.name)).not.toContain('Hidden Plan');
    });

    it('creates a join order against the real Razorpay API', async () => {
      const created = await service.createJoinOrder(orgId, 'INR', {
        planId,
        memberName: 'Anita Roy',
        email: 'anita@example.com',
        phone: '+91 98765 43210',
      });
      expect(created.ok).toBe(true);
      if (created.ok) {
        orderId = created.value.orderId;
        expect(orderId).toMatch(/^order_/);
        expect(created.value.amountPaise).toBe(210_000);
        expect(created.value.planName).toBe('Annual Member');
      }
    });

    it('rejects a forged signature', async () => {
      const forged = await service.confirmJoin(orgId, {
        providerOrderId: orderId,
        providerPaymentId: 'pay_x',
        signature: 'deadbeef',
      });
      expect(forged.ok).toBe(false);
      if (!forged.ok) expect(forged.error.code).toBe('FORBIDDEN');
    });

    it('confirms payment — active membership with 12-month expiry + donation receipt', async () => {
      const paymentId = 'pay_member_001';
      const signature = createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const confirmed = await service.confirmJoin(orgId, {
        providerOrderId: orderId,
        providerPaymentId: paymentId,
        signature,
      });
      expect(confirmed.ok).toBe(true);
      if (confirmed.ok) {
        expect(confirmed.value.planName).toBe('Annual Member');
        expect(confirmed.value.receiptNumber).toMatch(/^\d{4}-\d{5}$/);
        const todayIso = new Date().toISOString().slice(0, 10);
        expect(confirmed.value.expiresOn).toBe(addMonths(todayIso, 12));
      }

      const roster = await service.listMembers(ctx(), { status: 'active' });
      expect(roster.ok).toBe(true);
      if (roster.ok) {
        expect(roster.value.total).toBe(1);
        expect(roster.value.items[0]?.memberName).toBe('Anita Roy');
        expect(roster.value.items[0]?.isExpired).toBe(false);
      }
    });

    it('re-confirming is idempotent — one donation only', async () => {
      const paymentId = 'pay_member_001';
      const signature = createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      const again = await service.confirmJoin(orgId, {
        providerOrderId: orderId,
        providerPaymentId: paymentId,
        signature,
      });
      expect(again.ok).toBe(true);

      const rows = await admin
        .select()
        .from(donations)
        .where(inArray(donations.organizationId, [orgId]));
      expect(rows).toHaveLength(1);
    });

    it('cancelling removes from the active roster', async () => {
      const roster = await service.listMembers(ctx(), { status: 'active' });
      const subId = roster.ok ? roster.value.items[0]?.id : undefined;
      expect(subId).toBeTruthy();

      const cancelled = await service.cancelMembership(ctx(), subId!);
      expect(cancelled.ok).toBe(true);

      const active = await service.listMembers(ctx(), { status: 'active' });
      if (active.ok) expect(active.value.total).toBe(0);
      const cancelledList = await service.listMembers(ctx(), { status: 'cancelled' });
      if (cancelledList.ok) expect(cancelledList.value.total).toBe(1);
    });

    it('other tenant sees no plans or members of this org', async () => {
      const outsiderCtx: TenantContext = {
        organizationId: otherOrgId,
        userId: randomUUID(),
        roleKey: 'owner',
        templeIds: null,
      };
      const plans = await service.listPlans(outsiderCtx);
      expect(plans.ok).toBe(true);
      if (plans.ok) expect(plans.value).toHaveLength(0);

      const publicPlans = await service.listPublicPlans(otherOrgId);
      expect(publicPlans).toHaveLength(0);

      const roster = await service.listMembers(outsiderCtx, { status: 'all' });
      if (roster.ok) expect(roster.value.total).toBe(0);
    });
  },
);
