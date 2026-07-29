import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  inKindDonations,
  memberships,
  platformSubscriptions,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createInKindService } from './in-kind.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('in-kind: offerings register (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const inKind$ = createInKindService({ db });

  const run = `ink${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let goldId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(inKindDonations).where(inArray(inKindDonations.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(platformSubscriptions).where(inArray(platformSubscriptions.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and records two offerings', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('in-kind test'),
      { name: 'In-kind Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const gold = await inKind$.recordInKind(ctx, {
      donorName: 'Anonymous devotee',
      category: 'gold',
      item: 'Gold ring',
      quantity: 8.5,
      unit: 'grams',
      estimatedValue: 65000,
      receivedOn: '2026-06-01',
    });
    expect(gold.ok).toBe(true);
    if (gold.ok) goldId = gold.value.id;

    await inKind$.recordInKind(ctx, {
      donorName: 'Ramesh',
      category: 'grain',
      item: 'Rice',
      quantity: 50,
      unit: 'kg',
      estimatedValue: 3000,
      receivedOn: '2026-06-02',
    });
  });

  it('totals the in-stock valuation', async () => {
    const stats = await inKind$.getStats(ctx);
    expect(stats.ok).toBe(true);
    if (stats.ok) {
      expect(stats.value.inStockCount).toBe(2);
      expect(stats.value.inStockValue).toBe('68000.00'); // 65000 + 3000
    }
  });

  it('marking an item disposed removes it from in-stock totals', async () => {
    const done = await inKind$.setDisposition(ctx, goldId, {
      disposition: 'used',
      disposalNote: 'Melted into temple crown',
    });
    expect(done.ok).toBe(true);

    const stats = await inKind$.getStats(ctx);
    expect(stats.ok && stats.value.inStockCount).toBe(1);
    expect(stats.ok && stats.value.inStockValue).toBe('3000.00');

    const inStock = await inKind$.listInKind(ctx, { scope: 'in_stock' });
    if (inStock.ok) expect(inStock.value.find((x) => x.id === goldId)).toBeUndefined();

    const all = await inKind$.listInKind(ctx, { scope: 'all' });
    if (all.ok) {
      const g = all.value.find((x) => x.id === goldId);
      expect(g?.disposition).toBe('used');
      expect(g?.disposalNote).toBe('Melted into temple crown');
    }
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await inKind$.listInKind(viewer, { scope: 'all' });
    expect(read.ok).toBe(true);

    const write = await inKind$.recordInKind(viewer, {
      donorName: 'X',
      category: 'other',
      item: 'Something',
      receivedOn: '2026-06-03',
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
