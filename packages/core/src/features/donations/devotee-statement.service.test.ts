import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  devotees,
  domains,
  donationCategories,
  donationCounters,
  donations,
  memberships,
  platformSubscriptions,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDevoteeService } from '../devotees/devotee.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createDonationService } from './donation.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

function currentFyStart(): number {
  const now = new Date();
  return now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

describe.skipIf(!hasDb)('donations: devotee giving + annual statement (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const donationSvc = createDonationService({ db });
  const devoteeSvc = createDevoteeService({ db });

  const run = `stmt${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let devoteeId = '';
  const curFy = currentFyStart();

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(donations).where(inArray(donations.organizationId, [orgId]));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, [orgId]));
      await admin
        .delete(donationCategories)
        .where(inArray(donationCategories.organizationId, [orgId]));
      await admin.delete(devotees).where(inArray(devotees.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(platformSubscriptions).where(inArray(platformSubscriptions.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up an org, a devotee, and donations across two financial years', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('statement test'),
      { name: 'Statement Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const devotee = await devoteeSvc.createDevotee(ctx, { fullName: 'Ramesh Kumar' });
    expect(devotee.ok).toBe(true);
    if (devotee.ok) devoteeId = devotee.value.id;

    // Two donations in the current FY (recorded today).
    const a = await donationSvc.recordDonation(ctx, { amount: 1000, method: 'cash', devoteeId });
    const b = await donationSvc.recordDonation(ctx, { amount: 500, method: 'upi', devoteeId });
    // One in the previous FY (June of the prior FY start year is always in-year).
    const c = await donationSvc.recordDonation(ctx, {
      amount: 2000,
      method: 'cash',
      devoteeId,
      donatedOn: `${curFy - 1}-06-01`,
    });
    // An anonymous donation not linked to the devotee — must be excluded.
    const d = await donationSvc.recordDonation(ctx, {
      amount: 999,
      method: 'cash',
      donorName: 'Someone Else',
    });
    expect(a.ok && b.ok && c.ok && d.ok).toBe(true);
  });

  it('summarizes lifetime and current-FY giving for the devotee', async () => {
    const result = await donationSvc.getDevoteeGiving(ctx, devoteeId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const g = result.value;
    expect(g.lifetimeTotal).toBe('3500.00');
    expect(g.lifetimeCount).toBe(3);
    expect(g.fyTotal).toBe('1500.00');
    expect(g.fyCount).toBe(2);
    expect(g.fyLabel).toBe(`${curFy}–${curFy + 1}`);
    expect(g.recent.length).toBe(3);
  });

  it('builds the current-year statement with only that year’s receipts', async () => {
    const result = await donationSvc.getDevoteeStatement(ctx, devoteeId, curFy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.count).toBe(2);
    expect(result.value.total).toBe('1500.00');
    expect(result.value.items.every((i) => i.devoteeId === devoteeId)).toBe(true);
  });

  it('builds the prior-year statement independently', async () => {
    const result = await donationSvc.getDevoteeStatement(ctx, devoteeId, curFy - 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.count).toBe(1);
    expect(result.value.total).toBe('2000.00');
  });

  it('denies a role without donations:read', async () => {
    const stranger: TenantContext = { ...ctx, roleKey: 'no_such_role' };
    const denied = await donationSvc.getDevoteeGiving(stranger, devoteeId);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');
  });
});
