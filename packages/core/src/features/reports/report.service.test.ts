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
import { createReportService, csvField } from './report.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe('csvField', () => {
  it('passes plain values through and escapes special characters', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField(null)).toBe('');
    expect(csvField('Roy, Anita')).toBe('"Roy, Anita"');
    expect(csvField('says "hi"')).toBe('"says ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe.skipIf(!hasDb)('reports: summary, CSV export, RBAC, isolation (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const donationService = createDonationService({ db });
  const service = createReportService({ db });

  const run = `rep${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let otherOrgId = '';

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
      await admin.delete(memberships).where(inArray(memberships.organizationId, orgIds));
      await admin.delete(roles).where(inArray(roles.organizationId, orgIds));
      await admin.delete(domains).where(inArray(domains.organizationId, orgIds));
      await admin.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up org with donations across categories, methods and dates', async () => {
    const a = await orgService.provisionOrganization(
      systemContext('report test'),
      { name: 'Report Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(a.ok).toBe(true);
    if (a.ok) orgId = a.value.id;

    const b = await orgService.provisionOrganization(
      systemContext('report test'),
      { name: 'Other Org', slug: `${run}-other`, country: 'BD' },
      { userId: randomUUID(), email: `out-${run}@test.invalid` },
    );
    expect(b.ok).toBe(true);
    if (b.ok) otherOrgId = b.value.id;

    // Two in "General Donation" (cash + upi), one Annadanam, one old, one voided
    const entries = [
      { amount: '501', method: 'cash', donorName: 'Donor A', categoryName: 'General Donation' },
      { amount: '999', method: 'upi', donorName: 'Donor B', categoryName: 'General Donation' },
      { amount: '2100', method: 'cash', donorName: 'Roy, Anita', categoryName: 'Annadanam' },
      {
        amount: '5000',
        method: 'bank_transfer',
        donorName: 'Old Donor',
        categoryName: 'Annadanam',
        donatedOn: '2020-01-15',
      },
    ];
    for (const e of entries) {
      const r = await donationService.recordDonation(ctx(), e);
      expect(r.ok).toBe(true);
    }

    const toVoid = await donationService.recordDonation(ctx(), {
      amount: '777',
      method: 'cash',
      donorName: 'Mistake',
    });
    expect(toVoid.ok).toBe(true);
    if (toVoid.ok) {
      const voided = await donationService.voidDonation(ctx(), toVoid.value.id, {
        reason: 'test void',
      });
      expect(voided.ok).toBe(true);
    }
  });

  it('all-time summary groups by category and method, excludes void', async () => {
    const report = await service.getDonationReport(ctx(), {});
    expect(report.ok).toBe(true);
    if (!report.ok) return;

    expect(report.value.count).toBe(4);
    expect(Number(report.value.total)).toBeCloseTo(501 + 999 + 2100 + 5000);
    expect(report.value.voidCount).toBe(1);
    expect(report.value.currency).toBe('INR');

    const annadanam = report.value.byCategory.find((c) => c.label === 'Annadanam');
    expect(annadanam?.count).toBe(2);
    expect(Number(annadanam?.total)).toBeCloseTo(7100);

    const general = report.value.byCategory.find((c) => c.label === 'General Donation');
    expect(general?.count).toBe(2);

    const cash = report.value.byMethod.find((m) => m.label === 'cash');
    expect(cash?.count).toBe(2); // voided cash entry excluded
    expect(Number(cash?.total)).toBeCloseTo(2601);
  });

  it('date range filters correctly', async () => {
    const thisYear = new Date().getFullYear();
    const recent = await service.getDonationReport(ctx(), { from: `${thisYear}-01-01` });
    expect(recent.ok).toBe(true);
    if (recent.ok) {
      expect(recent.value.count).toBe(3); // old 2020 donation excluded
      expect(Number(recent.value.total)).toBeCloseTo(3600);
    }

    const oldOnly = await service.getDonationReport(ctx(), {
      from: '2020-01-01',
      to: '2020-12-31',
    });
    expect(oldOnly.ok).toBe(true);
    if (oldOnly.ok) {
      expect(oldOnly.value.count).toBe(1);
      expect(Number(oldOnly.value.total)).toBeCloseTo(5000);
    }

    const badRange = await service.getDonationReport(ctx(), {
      from: '2026-05-01',
      to: '2026-01-01',
    });
    expect(badRange.ok).toBe(false);
  });

  it('CSV export contains header, escaped fields, and void rows marked', async () => {
    const csv = await service.exportDonationsCsv(ctx(), {});
    expect(csv.ok).toBe(true);
    if (!csv.ok) return;

    const lines = csv.value.trim().split('\r\n');
    expect(lines[0]).toBe(
      'Receipt No,Date,Donor,Category,Method,Reference,Amount,Currency,Status,Void Reason,Note',
    );
    expect(lines).toHaveLength(6); // header + 5 rows (incl. void)
    expect(csv.value).toContain('"Roy, Anita"'); // comma escaped
    expect(csv.value).toContain('void,test void');
    expect(csv.value).toContain('5000.00');
  });

  it('staff and viewer are denied reports', async () => {
    for (const roleKey of ['staff', 'viewer']) {
      const denied = await service.getDonationReport(ctx(roleKey), {});
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');

      const deniedCsv = await service.exportDonationsCsv(ctx(roleKey), {});
      expect(deniedCsv.ok).toBe(false);
    }
  });

  it('other tenant sees an empty report', async () => {
    const outsiderCtx: TenantContext = {
      organizationId: otherOrgId,
      userId: randomUUID(),
      roleKey: 'owner',
      templeIds: null,
    };
    const report = await service.getDonationReport(outsiderCtx, {});
    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.value.count).toBe(0);
      expect(report.value.byCategory).toHaveLength(0);
    }

    const csv = await service.exportDonationsCsv(outsiderCtx, {});
    if (csv.ok) expect(csv.value.trim().split('\r\n')).toHaveLength(1); // header only
  });
});
