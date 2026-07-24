import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  assets,
  auditLogs,
  createDb,
  domains,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createAssetService } from './asset.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('assets: register + valuation + disposal (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createAssetService({ db });

  const run = `ast${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let crownId = '';

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(assets).where(inArray(assets.organizationId, [orgId]));
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
      systemContext('assets test'),
      { name: 'Assets Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };
  });

  it('adds assets and values the active register (value × quantity)', async () => {
    const crown = await service.createAsset(ctx, {
      name: 'Gold crown (kireetam)',
      category: 'jewelry',
      quantity: 1,
      estimatedValue: 500000,
      location: 'Strong room',
    });
    expect(crown.ok).toBe(true);
    if (crown.ok) {
      crownId = crown.value.id;
      expect(crown.value.estimatedValue).toBe('500000.00');
      expect(crown.value.currency).toBe('INR');
      expect(crown.value.status).toBe('active');
    }

    const lamps = await service.createAsset(ctx, {
      name: 'Silver lamps',
      category: 'vessels',
      quantity: 10,
      estimatedValue: 8000,
    });
    expect(lamps.ok).toBe(true);

    const stats = await service.getStats(ctx);
    expect(stats.ok).toBe(true);
    if (stats.ok) {
      expect(stats.value.activeCount).toBe(2);
      // 500000 + (8000 × 10) = 580000
      expect(stats.value.activeValue).toBe('580000.00');
    }
  });

  it('validation rejects a short name and a viewer write', async () => {
    const bad = await service.createAsset(ctx, { name: 'x', category: 'other', quantity: 1 });
    expect(bad.ok).toBe(false);

    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const forbidden = await service.createAsset(viewer, {
      name: 'Sneaky asset',
      category: 'other',
      quantity: 1,
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.code).toBe('FORBIDDEN');
  });

  it('updates an asset', async () => {
    const updated = await service.updateAsset(ctx, crownId, {
      name: 'Gold crown (kireetam)',
      category: 'jewelry',
      quantity: 1,
      estimatedValue: 650000,
      location: 'Strong room, locker 1',
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.estimatedValue).toBe('650000.00');
      expect(updated.value.location).toBe('Strong room, locker 1');
    }
  });

  it('disposes an asset — it leaves the active value but stays in the register', async () => {
    const disposed = await service.disposeAsset(ctx, crownId, { reason: 'Sent for re-plating' });
    expect(disposed.ok).toBe(true);
    if (disposed.ok) {
      expect(disposed.value.status).toBe('disposed');
      expect(disposed.value.disposalReason).toBe('Sent for re-plating');
    }

    const stats = await service.getStats(ctx);
    // Only the silver lamps remain active: 8000 × 10 = 80000.
    expect(stats.ok && stats.value.activeCount).toBe(1);
    expect(stats.ok && stats.value.activeValue).toBe('80000.00');

    const activeList = await service.listAssets(ctx, 'active');
    expect(activeList.ok && activeList.value).toHaveLength(1);
    const allList = await service.listAssets(ctx, 'all');
    expect(allList.ok && allList.value).toHaveLength(2);
  });

  it('rejects a dispose without a reason', async () => {
    const bad = await service.disposeAsset(ctx, crownId, { reason: '' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALIDATION');
  });
});
