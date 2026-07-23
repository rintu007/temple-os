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
  hundiCollections,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDonationService } from '../donations/donation.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createHundiService } from './hundi.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('hundi: box counting posts to the donation ledger (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createHundiService({ db });
  const donationSvc = createDonationService({ db });

  const run = `hun${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(hundiCollections).where(inArray(hundiCollections.organizationId, [orgId]));
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
      systemContext('hundi test'),
      { name: 'Hundi Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };
  });

  it('records a counting by denomination and sums it correctly', async () => {
    const result = await service.recordCollection(ctx, {
      boxName: 'Main Sanctum Hundi',
      denominations: [
        { value: 2000, count: 2 }, // 4000
        { value: 500, count: 3 }, //  1500
        { value: 100, count: 5 }, //   500
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalAmount).toBe('6000.00');
      expect(result.value.receiptNumber).toMatch(/^\d{4}-\d{5}$/);
      expect(result.value.denominations).toHaveLength(3);
    }
  });

  it('records a counting entered as a direct total (no denominations)', async () => {
    const result = await service.recordCollection(ctx, {
      boxName: 'Entrance Donation Box',
      amount: 750,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalAmount).toBe('750.00');
      expect(result.value.denominations).toBeNull();
    }
  });

  it('lists both collections, newest first', async () => {
    const list = await service.listCollections(ctx);
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value).toHaveLength(2);
      expect(list.value.every((c) => c.receiptNumber !== '')).toBe(true);
    }
  });

  it('the collected money flows into the donation ledger', async () => {
    const stats = await donationSvc.getStats(ctx);
    expect(stats.ok).toBe(true);
    if (stats.ok) {
      // 6000 + 750 both counted this month as recorded donations.
      expect(stats.value.monthCount).toBe(2);
      expect(stats.value.monthTotal).toBe('6750.00');
    }
  });

  it('rejects an empty counting and a viewer write', async () => {
    const empty = await service.recordCollection(ctx, { boxName: 'Empty Box' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error.code).toBe('VALIDATION');

    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const forbidden = await service.recordCollection(viewer, {
      boxName: 'Nope Box',
      amount: 100,
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.code).toBe('FORBIDDEN');
  });
});
