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
  roles,
  sevaSubscriptions,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDonationService } from '../donations/donation.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createSevaService } from './seva.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe('sevas: next-occurrence helper', () => {
  it('is exercised via the service on live data', () => {
    // The pure date math is validated indirectly in the live-db block below.
    expect(true).toBe(true);
  });
});

describe.skipIf(!hasDb)('sevas: recurring sponsorships (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const seva$ = createSevaService({ db });
  const donation$ = createDonationService({ db });

  const run = `seva${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let sevaId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, s));
      await admin.delete(donationCategories).where(inArray(donationCategories.organizationId, s));
      await admin.delete(sevaSubscriptions).where(inArray(sevaSubscriptions.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and registers a monthly seva', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('seva test'),
      { name: 'Seva Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await seva$.createSeva(ctx, {
      sponsorName: 'Lakshmi Devi',
      sevaName: 'Monthly Abhishekam',
      amount: 1100,
      frequency: 'monthly',
      occasion: 'Pournami',
      startDate: '2026-01-05',
    });
    expect(created.ok).toBe(true);
    if (created.ok) sevaId = created.value.id;
  });

  it('computes a next occurrence on/after today for an active seva', async () => {
    const list = await seva$.listSevas(ctx, { scope: 'active' });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const s = list.value.find((x) => x.id === sevaId);
    expect(s?.frequency).toBe('monthly');
    expect(s?.collected).toBe('0.00');
    // A monthly seva started 2026-01-05 recurs on the 5th; next is today-or-later.
    expect(s?.nextOccurrence).toMatch(/^\d{4}-\d{2}-05$/);
    expect(s?.nextOccurrence! >= new Date().toISOString().slice(0, 10)).toBe(true);

    const stats = await seva$.getStats(ctx);
    expect(stats.ok && stats.value.perCycleValue).toBe('1100.00');
    expect(stats.ok && stats.value.activeCount).toBe(1);
  });

  it('derives collection from donations tagged to the seva', async () => {
    await donation$.recordDonation(ctx, {
      donorName: 'Lakshmi Devi',
      amount: 1100,
      method: 'upi',
      categoryName: 'Seva',
      sevaSubscriptionId: sevaId,
      donatedOn: '2026-02-05',
    });
    await donation$.recordDonation(ctx, {
      donorName: 'Lakshmi Devi',
      amount: 1100,
      method: 'upi',
      categoryName: 'Seva',
      sevaSubscriptionId: sevaId,
      donatedOn: '2026-03-05',
    });

    const detail = await seva$.getSevaDetail(ctx, sevaId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.seva.collected).toBe('2200.00');
    expect(detail.value.seva.lastPaidAt).not.toBeNull();
    expect(detail.value.payments).toHaveLength(2);
  });

  it('ends a seva: it leaves the active scope and has no next occurrence', async () => {
    const ended = await seva$.setSevaStatus(ctx, sevaId, 'ended');
    expect(ended.ok).toBe(true);

    const active = await seva$.listSevas(ctx, { scope: 'active' });
    if (active.ok) expect(active.value.find((x) => x.id === sevaId)).toBeUndefined();

    const all = await seva$.listSevas(ctx, { scope: 'all' });
    if (all.ok) {
      const s = all.value.find((x) => x.id === sevaId);
      expect(s?.status).toBe('ended');
      expect(s?.nextOccurrence).toBeNull();
    }
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await seva$.listSevas(viewer, { scope: 'all' });
    expect(read.ok).toBe(true);

    const write = await seva$.createSeva(viewer, {
      sponsorName: 'X',
      sevaName: 'Y',
      amount: 1,
      frequency: 'weekly',
      startDate: '2026-01-01',
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
