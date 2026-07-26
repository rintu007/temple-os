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
  pledges,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createPledgeService } from './pledge.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('pledges: promised-donation ledger (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createPledgeService({ db });

  const run = `pl${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let pledgeId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, s));
      await admin.delete(donationCategories).where(inArray(donationCategories.organizationId, s));
      await admin.delete(pledges).where(inArray(pledges.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and records a pledge', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('pledge test'),
      { name: 'Pledge Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await service.createPledge(ctx, {
      donorName: 'Ramesh Gupta',
      amount: 10000,
      pledgedOn: '2026-07-01',
      dueDate: '2026-07-15',
    });
    expect(created.ok).toBe(true);
    if (created.ok) pledgeId = created.value.id;
  });

  it('shows the pledge as fully outstanding and overdue', async () => {
    const detail = await service.getPledgeDetail(ctx, pledgeId);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.value.pledge.outstanding).toBe('10000.00');
      expect(detail.value.pledge.progress).toBe('unfulfilled');
      expect(detail.value.pledge.isOverdue).toBe(true);
      expect(detail.value.fulfilments).toHaveLength(0);
    }
  });

  it('records a partial fulfilment as a donation receipt', async () => {
    const fulfil = await service.fulfilPledge(ctx, pledgeId, { amount: 4000, method: 'upi' });
    expect(fulfil.ok).toBe(true);
    if (fulfil.ok) expect(fulfil.value.receiptNumber).toMatch(/^\d{4}-\d{5}$/);

    const detail = await service.getPledgeDetail(ctx, pledgeId);
    if (detail.ok) {
      expect(detail.value.pledge.received).toBe('4000.00');
      expect(detail.value.pledge.outstanding).toBe('6000.00');
      expect(detail.value.pledge.progress).toBe('partial');
      expect(detail.value.fulfilments).toHaveLength(1);
    }
  });

  it('rejects a fulfilment beyond the outstanding balance', async () => {
    const over = await service.fulfilPledge(ctx, pledgeId, { amount: 7000, method: 'cash' });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe('VALIDATION');
  });

  it('marks the pledge fulfilled once the balance is received', async () => {
    const rest = await service.fulfilPledge(ctx, pledgeId, { amount: 6000, method: 'bank_transfer' });
    expect(rest.ok).toBe(true);

    const detail = await service.getPledgeDetail(ctx, pledgeId);
    if (detail.ok) {
      expect(detail.value.pledge.progress).toBe('fulfilled');
      expect(detail.value.pledge.outstanding).toBe('0.00');
      expect(detail.value.pledge.isOverdue).toBe(false);
    }
  });

  it('reports stats and exports the register', async () => {
    const stats = await service.getStats(ctx);
    expect(stats.ok).toBe(true);
    if (stats.ok) {
      // The only pledge is now fully received → nothing outstanding.
      expect(stats.value.totalOutstanding).toBe('0.00');
    }

    const csv = await service.exportCsv(ctx);
    expect(csv.ok).toBe(true);
    if (csv.ok) {
      expect(csv.value).toContain('Donor,Campaign,Pledged On,Due Date,Amount,Received,Outstanding');
      expect(csv.value).toContain('Ramesh Gupta');
    }
  });

  it('cancels an unstarted pledge and blocks a viewer from writing', async () => {
    const created = await service.createPledge(ctx, {
      donorName: 'Sita Devi',
      amount: 2500,
      pledgedOn: '2026-07-05',
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      const cancelled = await service.cancelPledge(ctx, created.value.id, { reason: 'withdrawn' });
      expect(cancelled.ok).toBe(true);
    }

    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const write = await service.createPledge(viewer, {
      donorName: 'No One',
      amount: 100,
      pledgedOn: '2026-07-05',
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
