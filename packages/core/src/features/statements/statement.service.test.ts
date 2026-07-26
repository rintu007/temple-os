import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  donationCategories,
  donations,
  expenseCategories,
  expenses,
  memberships,
  newId,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import {
  createStatementService,
  financialYearOf,
  financialYearRange,
} from './statement.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe('statements: financial-year helpers', () => {
  it('maps dates to the April–March financial year', () => {
    expect(financialYearOf(new Date('2026-07-26'))).toBe(2026);
    expect(financialYearOf(new Date('2026-02-15'))).toBe(2025);
    expect(financialYearRange(2026)).toEqual({
      from: '2026-04-01',
      to: '2027-03-31',
      label: '2026–2027',
    });
  });
});

describe.skipIf(!hasDb)('statements: income & expenditure (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createStatementService({ db });

  const run = `stm${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(donationCategories).where(inArray(donationCategories.organizationId, s));
      await admin.delete(expenses).where(inArray(expenses.organizationId, s));
      await admin.delete(expenseCategories).where(inArray(expenseCategories.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and seeds ledger entries', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('statement test'),
      { name: 'Statement Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const genCat = newId();
    const poojaCat = newId();
    const salaryCat = newId();
    await admin.insert(donationCategories).values([
      { id: genCat, organizationId: orgId, name: 'General' },
      { id: poojaCat, organizationId: orgId, name: 'Pooja' },
    ]);
    await admin.insert(expenseCategories).values([
      { id: salaryCat, organizationId: orgId, name: 'Salaries' },
    ]);

    const at = new Date('2026-05-10T10:00:00Z');
    await admin.insert(donations).values([
      { id: newId(), organizationId: orgId, categoryId: genCat, donorName: 'A', amount: '1000.00', currency: 'INR', method: 'cash', receiptNumber: `${run}-1`, status: 'recorded', donatedAt: at },
      { id: newId(), organizationId: orgId, categoryId: poojaCat, donorName: 'B', amount: '500.50', currency: 'INR', method: 'upi', receiptNumber: `${run}-2`, status: 'recorded', donatedAt: at },
      { id: newId(), organizationId: orgId, categoryId: genCat, donorName: 'C', amount: '999.00', currency: 'INR', method: 'cash', receiptNumber: `${run}-3`, status: 'void', donatedAt: at },
    ]);
    await admin.insert(expenses).values([
      { id: newId(), organizationId: orgId, categoryId: salaryCat, paidTo: 'Priest', amount: '400.00', currency: 'INR', method: 'cash', voucherNumber: `${run}-EV1`, status: 'recorded', spentAt: at },
    ]);
  });

  it('produces income & expenditure grouped by category with a correct net', async () => {
    const fy = financialYearRange(2026);
    const result = await service.getStatement(ctx, { from: fy.from, to: fy.to });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.value;

    // Income excludes the voided donation: 1000.00 + 500.50 = 1500.50
    expect(s.incomeTotal).toBe('1500.50');
    expect(s.expenditureTotal).toBe('400.00');
    expect(s.net).toBe('1100.50');
    expect(s.income.find((l) => l.label === 'General')?.total).toBe('1000.00');
    expect(s.income.find((l) => l.label === 'Pooja')?.total).toBe('500.50');
    expect(s.expenditure).toHaveLength(1);
  });

  it('excludes entries outside the range', async () => {
    const result = await service.getStatement(ctx, { from: '2025-04-01', to: '2026-03-31' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.incomeTotal).toBe('0.00');
      expect(result.value.net).toBe('0.00');
    }
  });

  it('exports a CSV statement', async () => {
    const fy = financialYearRange(2026);
    const csv = await service.exportCsv(ctx, { from: fy.from, to: fy.to });
    expect(csv.ok).toBe(true);
    if (csv.ok) {
      expect(csv.value).toContain('Income & Expenditure Statement');
      expect(csv.value).toContain('Income,Total,1500.50');
      expect(csv.value).toContain('Net,Surplus,1100.50');
    }
  });
});
