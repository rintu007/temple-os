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
  platformSubscriptions,
  organizations,
  roles,
  taxProfiles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDonationService } from '../donations/donation.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createTaxService } from './tax.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('tax: 80G profile + receipts (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const tax$ = createTaxService({ db });
  const donation$ = createDonationService({ db });

  const run = `tax${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let donationId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(taxProfiles).where(inArray(taxProfiles.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, s));
      await admin.delete(donationCategories).where(inArray(donationCategories.organizationId, s));
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

  it('provisions an org and records a donation with a donor PAN', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('tax test'),
      { name: 'Tax Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const rec = await donation$.recordDonation(ctx, {
      donorName: 'Ravi Kumar',
      amount: 5000,
      method: 'upi',
      categoryName: 'General',
      donorPan: 'aaatt1234c', // lowercase — should normalise to uppercase
      donatedOn: '2026-06-10',
    });
    expect(rec.ok).toBe(true);
    if (rec.ok) donationId = rec.value.id;
  });

  it('starts with no profile', async () => {
    const p = await tax$.getProfile(ctx);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.value).toBeNull();
  });

  it('rejects an invalid PAN on the profile', async () => {
    const bad = await tax$.saveProfile(ctx, {
      legalName: 'Shree Temple Trust',
      pan: 'NOTAPAN',
      registrationNumber: 'AAATT1234CF20219',
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALIDATION');
  });

  it('saves and updates the 80G profile idempotently', async () => {
    const saved = await tax$.saveProfile(ctx, {
      legalName: 'Shree Temple Trust',
      pan: 'aaatt1234c',
      registrationNumber: 'AAATT1234CF20219',
      validFrom: '2021-04-01',
      showOnReceipt: true,
    });
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.value.pan).toBe('AAATT1234C');
      expect(saved.value.legalName).toBe('Shree Temple Trust');
    }

    // Second save updates in place, not a duplicate insert.
    const again = await tax$.saveProfile(ctx, {
      legalName: 'Shree Temple Charitable Trust',
      registrationNumber: 'AAATT1234CF20219',
      showOnReceipt: true,
    });
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.legalName).toBe('Shree Temple Charitable Trust');
      expect(again.value.pan).toBeNull();
    }
  });

  it('builds an 80G receipt for the donation', async () => {
    const r = await tax$.getReceipt(ctx, donationId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.donorName).toBe('Ravi Kumar');
    expect(r.value.donorPan).toBe('AAATT1234C');
    expect(r.value.amount).toBe('5000.00');
    expect(r.value.currency).toBe('INR');
    expect(r.value.financialYearLabel).toBe('2026–2027');
    expect(r.value.isVoid).toBe(false);
    expect(r.value.tax?.registrationNumber).toBe('AAATT1234CF20219');
  });

  it('omits the 80G block when showOnReceipt is off', async () => {
    await tax$.saveProfile(ctx, {
      legalName: 'Shree Temple Charitable Trust',
      registrationNumber: 'AAATT1234CF20219',
      showOnReceipt: false,
    });
    const r = await tax$.getReceipt(ctx, donationId);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.tax).toBeNull();
  });

  it('returns NOT_FOUND for an unknown donation', async () => {
    const r = await tax$.getReceipt(ctx, randomUUID());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_FOUND');
  });

  it('a viewer can read a receipt but not write the profile', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await tax$.getReceipt(viewer, donationId);
    expect(read.ok).toBe(true);

    const write = await tax$.saveProfile(viewer, {
      legalName: 'X Trust',
      registrationNumber: 'AAATT1234CF20219',
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
