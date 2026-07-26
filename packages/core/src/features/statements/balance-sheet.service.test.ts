import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  assets,
  auditLogs,
  createDb,
  domains,
  donationCategories,
  donations,
  expenseCategories,
  expenses,
  financialAccounts,
  funds,
  memberships,
  newId,
  organizations,
  roles,
  users,
  vendorBills,
  vendors,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createStatementService } from './statement.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('statements: balance sheet (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createStatementService({ db });

  const run = `bsheet${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(vendorBills).where(inArray(vendorBills.organizationId, s));
      await admin.delete(vendors).where(inArray(vendors.organizationId, s));
      await admin.delete(assets).where(inArray(assets.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(donationCategories).where(inArray(donationCategories.organizationId, s));
      await admin.delete(expenses).where(inArray(expenses.organizationId, s));
      await admin.delete(expenseCategories).where(inArray(expenseCategories.organizationId, s));
      await admin.delete(funds).where(inArray(funds.organizationId, s));
      await admin.delete(financialAccounts).where(inArray(financialAccounts.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and seeds a full financial position', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('balance sheet test'),
      { name: 'Balance Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const buildingFund = newId();
    const vendorId = newId();
    const at = new Date('2026-05-10T10:00:00Z');

    await admin
      .insert(financialAccounts)
      .values([
        { id: newId(), organizationId: orgId, name: 'Cash', type: 'cash', openingBalance: '10000.00' },
      ]);
    await admin
      .insert(funds)
      .values([{ id: buildingFund, organizationId: orgId, name: 'Building', isActive: true }]);
    await admin.insert(donations).values([
      // 3000 earmarked to Building, 5000 general.
      { id: newId(), organizationId: orgId, fundId: buildingFund, donorName: 'A', amount: '3000.00', currency: 'INR', method: 'cash', receiptNumber: `${run}-1`, status: 'recorded', donatedAt: at },
      { id: newId(), organizationId: orgId, donorName: 'B', amount: '5000.00', currency: 'INR', method: 'cash', receiptNumber: `${run}-2`, status: 'recorded', donatedAt: at },
    ]);
    await admin.insert(expenses).values([
      { id: newId(), organizationId: orgId, paidTo: 'Sundry', amount: '2000.00', currency: 'INR', method: 'cash', voucherNumber: `${run}-EV1`, status: 'recorded', spentAt: at },
    ]);
    await admin.insert(assets).values([
      { id: newId(), organizationId: orgId, name: 'Temple land', category: 'land', estimatedValue: '50000.00', currency: 'INR', status: 'active' },
    ]);
    await admin
      .insert(vendors)
      .values([{ id: vendorId, organizationId: orgId, name: 'Decorators Ltd', isActive: true }]);
    await admin.insert(vendorBills).values([
      { id: newId(), organizationId: orgId, vendorId, billNumber: `${run}-B1`, amount: '4000.00', currency: 'INR', billDate: '2026-05-01', status: 'open' },
    ]);
  });

  it('derives a balance sheet whose two sides agree', async () => {
    const result = await service.getBalanceSheet(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.value;

    // Cash & bank = opening 10000 + donations 8000 − expenses 2000 = 16000
    expect(s.assets.find((l) => l.label.startsWith('Cash'))?.total).toBe('16000.00');
    // Fixed assets at book value 50000
    expect(s.assets.find((l) => l.label.startsWith('Fixed'))?.total).toBe('50000.00');
    expect(s.assetsTotal).toBe('66000.00');

    // Payables from the open vendor bill
    expect(s.liabilitiesTotal).toBe('4000.00');

    // Earmarked Building fund shows its balance
    expect(s.funds.find((l) => l.label === 'Building')?.total).toBe('3000.00');
    // General fund is the balancing figure = 66000 − 4000 − 3000 = 59000
    expect(s.funds.find((l) => l.label === 'General fund')?.total).toBe('59000.00');
    expect(s.fundsTotal).toBe('62000.00');

    // The sheet must balance: assets = liabilities + funds.
    const liabPlusFunds = Number(s.liabilitiesTotal) + Number(s.fundsTotal);
    expect(liabPlusFunds.toFixed(2)).toBe(s.assetsTotal);
  });

  it('exports a balance sheet CSV', async () => {
    const csv = await service.exportBalanceSheetCsv(ctx);
    expect(csv.ok).toBe(true);
    if (csv.ok) {
      expect(csv.value).toContain('Balance Sheet');
      expect(csv.value).toContain('Assets,Total,66000.00');
      expect(csv.value).toContain('Funds,General fund,59000.00');
    }
  });

  it('a viewer without reports:read is refused', async () => {
    const noReports: TenantContext = { ...ctx, roleKey: 'nobody' };
    const res = await service.getBalanceSheet(noReports);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('FORBIDDEN');
  });
});
