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
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDonationService } from '../donations/donation.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createAuditService } from './audit.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('audit: activity trail with actor names + filters (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createAuditService({ db });
  const donationSvc = createDonationService({ db });

  const run = `aud${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Radha Devi' };
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
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and records an action', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('audit test'),
      { name: 'Audit Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const donation = await donationSvc.recordDonation(ctx, {
      amount: 1100,
      method: 'cash',
      donorName: 'A Devotee',
    });
    expect(donation.ok).toBe(true);
  });

  it('lists activity with the actor name resolved', async () => {
    const result = await service.listActivity(ctx, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBeGreaterThan(0);

    const donationEntry = result.value.items.find((i) => i.action === 'donation.recorded');
    expect(donationEntry).toBeTruthy();
    expect(donationEntry?.actorName).toBe('Radha Devi');
  });

  it('filters by entity type', async () => {
    const result = await service.listActivity(ctx, { entityType: 'donation' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items.every((i) => i.entityType === 'donation')).toBe(true);
  });

  it('lists the distinct entity types and exports CSV', async () => {
    const types = await service.listEntityTypes(ctx);
    expect(types.ok).toBe(true);
    if (types.ok) expect(types.value).toContain('donation');

    const csv = await service.exportCsv(ctx, {});
    expect(csv.ok).toBe(true);
    if (csv.ok) {
      expect(csv.value).toContain('Timestamp,Actor,Action,Entity,Entity ID');
      expect(csv.value).toContain('Radha Devi');
    }
  });

  it('denies a role without governance:read', async () => {
    const stranger: TenantContext = { ...ctx, roleKey: 'no_such_role' };
    const denied = await service.listActivity(stranger, {});
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');
  });
});
