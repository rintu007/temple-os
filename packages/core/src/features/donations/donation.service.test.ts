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
  families,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDevoteeService } from '../devotees/devotee.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createDonationService } from './donation.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('donations: receipts, categories, RBAC, isolation (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const devoteeService = createDevoteeService({ db });
  const service = createDonationService({ db });

  const run = `don${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  const outsider = { userId: randomUUID(), email: `out-${run}@test.invalid`, fullName: 'Out' };
  let orgId = '';
  let otherOrgId = '';
  let devoteeId = '';
  let donationId = '';

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
      await admin.delete(donations).where(inArray(donations.organizationId, orgIds));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, orgIds));
      await admin
        .delete(donationCategories)
        .where(inArray(donationCategories.organizationId, orgIds));
      await admin.delete(devotees).where(inArray(devotees.organizationId, orgIds));
      await admin.delete(families).where(inArray(families.organizationId, orgIds));
      await admin.delete(memberships).where(inArray(memberships.organizationId, orgIds));
      await admin.delete(roles).where(inArray(roles.organizationId, orgIds));
      await admin.delete(domains).where(inArray(domains.organizationId, orgIds));
      await admin.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId, outsider.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up org and devotee', async () => {
    const a = await orgService.provisionOrganization(
      systemContext('donation test'),
      { name: 'Donation Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(a.ok).toBe(true);
    if (a.ok) orgId = a.value.id;

    const b = await orgService.provisionOrganization(
      systemContext('donation test'),
      { name: 'Other Org', slug: `${run}-other`, country: 'BD' },
      outsider,
    );
    expect(b.ok).toBe(true);
    if (b.ok) otherOrgId = b.value.id;

    const devotee = await devoteeService.createDevotee(ctx(), { fullName: 'Anita Chatterjee' });
    expect(devotee.ok).toBe(true);
    if (devotee.ok) devoteeId = devotee.value.id;
  });

  it('records donations with sequential receipt numbers and org currency', async () => {
    const year = new Date().getFullYear();

    const first = await service.recordDonation(ctx(), {
      amount: '501',
      method: 'cash',
      devoteeId,
      categoryName: 'General Donation',
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      donationId = first.value.id;
      expect(first.value.receiptNumber).toBe(`${year}-00001`);
      expect(first.value.amount).toBe('501.00');
      expect(first.value.currency).toBe('INR');
      expect(first.value.donorName).toBe('Anita Chatterjee'); // from devotee
    }

    const second = await service.recordDonation(ctx(), {
      amount: '1100.5',
      method: 'upi',
      donorName: 'Walk-in Devotee',
      categoryName: 'general donation', // case-insensitive reuse
      reference: 'UPI-12345',
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.receiptNumber).toBe(`${year}-00002`);
      expect(second.value.amount).toBe('1100.50');
    }
  });

  it('rejects bad input', async () => {
    const noDonor = await service.recordDonation(ctx(), { amount: '100', method: 'cash' });
    expect(noDonor.ok).toBe(false);

    const badAmount = await service.recordDonation(ctx(), {
      amount: '-5',
      method: 'cash',
      donorName: 'X',
    });
    expect(badAmount.ok).toBe(false);

    const onlineBlocked = await service.recordDonation(ctx(), {
      amount: '100',
      method: 'online',
      donorName: 'X',
    });
    expect(onlineBlocked.ok).toBe(false);
  });

  it('lists with search and computes stats', async () => {
    const all = await service.listDonations(ctx(), {});
    expect(all.ok).toBe(true);
    if (all.ok) expect(all.value.total).toBe(2);

    const searched = await service.listDonations(ctx(), { search: 'walk-in' });
    if (searched.ok) expect(searched.value.total).toBe(1);

    const stats = await service.getStats(ctx());
    expect(stats.ok).toBe(true);
    if (stats.ok) {
      expect(stats.value.monthCount).toBe(2);
      expect(Number(stats.value.monthTotal)).toBeCloseTo(1601.5);
      expect(stats.value.currency).toBe('INR');
    }
  });

  it('staff can record but cannot void; owner voids with reason', async () => {
    const staffVoid = await service.voidDonation(ctx('staff'), donationId, {
      reason: 'entered twice',
    });
    expect(staffVoid.ok).toBe(false);
    if (!staffVoid.ok) expect(staffVoid.error.code).toBe('FORBIDDEN');

    const voided = await service.voidDonation(ctx(), donationId, { reason: 'entered twice' });
    expect(voided.ok).toBe(true);

    const again = await service.voidDonation(ctx(), donationId, { reason: 'again' });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('CONFLICT');

    // Voided donations drop out of stats but stay listed
    const stats = await service.getStats(ctx());
    if (stats.ok) {
      expect(stats.value.monthCount).toBe(1);
      expect(Number(stats.value.monthTotal)).toBeCloseTo(1100.5);
    }
  });

  it('other tenant sees nothing; receipt sequences are independent', async () => {
    const outsiderCtx: TenantContext = {
      organizationId: otherOrgId,
      userId: outsider.userId,
      roleKey: 'owner',
      templeIds: null,
    };
    const list = await service.listDonations(outsiderCtx, {});
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.value.total).toBe(0);

    const get = await service.getDonation(outsiderCtx, donationId);
    expect(get.ok).toBe(false);

    const own = await service.recordDonation(outsiderCtx, {
      amount: '250',
      method: 'cash',
      donorName: 'BD Donor',
    });
    expect(own.ok).toBe(true);
    if (own.ok) {
      expect(own.value.receiptNumber).toBe(`${new Date().getFullYear()}-00001`); // own counter
      expect(own.value.currency).toBe('BDT'); // own currency
    }
  });
});
