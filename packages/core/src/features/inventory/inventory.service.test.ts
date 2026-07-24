import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  inventoryItems,
  inventoryMovements,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createInventoryService } from './inventory.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('inventory: stock movements + low-stock (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createInventoryService({ db });

  const run = `inv${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let gheeId = '';

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin
        .delete(inventoryMovements)
        .where(inArray(inventoryMovements.organizationId, [orgId]));
      await admin.delete(inventoryItems).where(inArray(inventoryItems.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and adds an item at zero stock', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('inventory test'),
      { name: 'Inventory Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const ghee = await service.createItem(ctx, {
      name: 'Ghee',
      category: 'Prasadam kitchen',
      unit: 'kg',
      reorderLevel: 2,
    });
    expect(ghee.ok).toBe(true);
    if (ghee.ok) {
      gheeId = ghee.value.id;
      expect(ghee.value.currentStock).toBe('0.000');
      // Zero stock ≤ reorder level 2 → low from the start.
      expect(ghee.value.isLow).toBe(true);
    }
  });

  it('stock-in and issue move the balance and clear/set the low flag', async () => {
    const stockedIn = await service.recordMovement(ctx, gheeId, { kind: 'in', quantity: 10 });
    expect(stockedIn.ok).toBe(true);
    if (stockedIn.ok) {
      expect(stockedIn.value.currentStock).toBe('10.000');
      expect(stockedIn.value.isLow).toBe(false);
    }

    const issued = await service.recordMovement(ctx, gheeId, { kind: 'out', quantity: 8.5 });
    expect(issued.ok).toBe(true);
    if (issued.ok) {
      expect(issued.value.currentStock).toBe('1.500');
      // 1.5 ≤ reorder 2 → low again.
      expect(issued.value.isLow).toBe(true);
    }
  });

  it('cannot issue more than is in stock', async () => {
    const over = await service.recordMovement(ctx, gheeId, { kind: 'out', quantity: 100 });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe('CONFLICT');
  });

  it('a stock-take sets the absolute balance', async () => {
    const counted = await service.recordMovement(ctx, gheeId, { kind: 'adjust', quantity: 3.25 });
    expect(counted.ok).toBe(true);
    if (counted.ok) {
      expect(counted.value.currentStock).toBe('3.250');
      expect(counted.value.isLow).toBe(false);
    }
  });

  it('records the movement history and stats', async () => {
    const history = await service.listMovements(ctx, gheeId);
    expect(history.ok).toBe(true);
    if (history.ok) {
      // in, out, adjust = 3 successful movements (the over-issue was rejected).
      expect(history.value).toHaveLength(3);
      expect(history.value[0]!.kind).toBe('adjust');
      expect(history.value[0]!.balanceAfter).toBe('3.250');
    }

    const stats = await service.getStats(ctx);
    expect(stats.ok && stats.value.itemCount).toBe(1);
    expect(stats.ok && stats.value.lowStockCount).toBe(0);
  });

  it('rejects a non-positive stock-in and a viewer write', async () => {
    const zero = await service.recordMovement(ctx, gheeId, { kind: 'in', quantity: 0 });
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.error.code).toBe('VALIDATION');

    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const forbidden = await service.recordMovement(viewer, gheeId, { kind: 'in', quantity: 1 });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.code).toBe('FORBIDDEN');
  });
});
