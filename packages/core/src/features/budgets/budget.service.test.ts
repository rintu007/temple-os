import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  budgets,
  createDb,
  domains,
  donationCategories,
  donationCounters,
  donations,
  expenseCategories,
  expenseCounters,
  expenses,
  memberships,
  platformSubscriptions,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDonationService } from '../donations/donation.service';
import { createExpenseService } from '../expenses/expense.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createBudgetService } from './budget.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);
const FY = 2026; // April 2026 – March 2027

describe.skipIf(!hasDb)('budgets: budget vs actuals (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const budget$ = createBudgetService({ db });
  const donation$ = createDonationService({ db });
  const expense$ = createExpenseService({ db });

  const run = `bud${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(budgets).where(inArray(budgets.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, s));
      await admin.delete(donationCategories).where(inArray(donationCategories.organizationId, s));
      await admin.delete(expenses).where(inArray(expenses.organizationId, s));
      await admin.delete(expenseCounters).where(inArray(expenseCounters.organizationId, s));
      await admin.delete(expenseCategories).where(inArray(expenseCategories.organizationId, s));
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

  it('provisions an org and seeds ledger entries for the FY', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('budget test'),
      { name: 'Budget Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    // Income of 8000 in "Hundi"; expense of 3000 in "Salaries", inside FY2026.
    await donation$.recordDonation(ctx, {
      donorName: 'A',
      amount: 8000,
      method: 'cash',
      categoryName: 'Hundi',
      donatedOn: '2026-06-10',
    });
    await expense$.recordExpense(ctx, {
      paidTo: 'Priest',
      amount: 3000,
      method: 'cash',
      categoryName: 'Salaries',
      spentOn: '2026-06-12',
    });
  });

  it('sets budgets and compares them against live actuals', async () => {
    const b1 = await budget$.setBudget(ctx, {
      financialYear: FY,
      kind: 'income',
      category: 'Hundi',
      amount: 10000,
    });
    expect(b1.ok).toBe(true);
    await budget$.setBudget(ctx, {
      financialYear: FY,
      kind: 'expense',
      category: 'Salaries',
      amount: 2500,
    });

    const cmp = await budget$.getComparison(ctx, { fy: FY });
    expect(cmp.ok).toBe(true);
    if (!cmp.ok) return;

    const hundi = cmp.value.income.rows.find((r) => r.category === 'Hundi');
    expect(hundi?.budget).toBe('10000.00');
    expect(hundi?.actual).toBe('8000.00');
    expect(hundi?.variance).toBe('-2000.00'); // under target

    const salaries = cmp.value.expense.rows.find((r) => r.category === 'Salaries');
    expect(salaries?.budget).toBe('2500.00');
    expect(salaries?.actual).toBe('3000.00');
    expect(salaries?.variance).toBe('500.00'); // overspent

    expect(cmp.value.income.budgetTotal).toBe('10000.00');
    expect(cmp.value.expense.actualTotal).toBe('3000.00');
  });

  it('upserting the same line updates rather than duplicates', async () => {
    await budget$.setBudget(ctx, {
      financialYear: FY,
      kind: 'income',
      category: 'Hundi',
      amount: 12000,
    });
    const cmp = await budget$.getComparison(ctx, { fy: FY });
    if (cmp.ok) {
      const hundiRows = cmp.value.income.rows.filter((r) => r.category === 'Hundi');
      expect(hundiRows).toHaveLength(1);
      expect(hundiRows[0]?.budget).toBe('12000.00');
    }
  });

  it('lists years with budgets and removes a line', async () => {
    const years = await budget$.listYears(ctx);
    expect(years.ok && years.value).toContain(FY);

    const cmp = await budget$.getComparison(ctx, { fy: FY });
    const salariesId =
      cmp.ok ? cmp.value.expense.rows.find((r) => r.category === 'Salaries')?.id : null;
    expect(salariesId).toBeTruthy();
    if (salariesId) {
      const removed = await budget$.removeBudget(ctx, salariesId);
      expect(removed.ok).toBe(true);
    }

    // Salaries still appears (it has actuals) but now with a zero budget.
    const after = await budget$.getComparison(ctx, { fy: FY });
    if (after.ok) {
      const salaries = after.value.expense.rows.find((r) => r.category === 'Salaries');
      expect(salaries?.budget).toBe('0.00');
      expect(salaries?.actual).toBe('3000.00');
      expect(salaries?.id).toBeNull();
    }
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await budget$.getComparison(viewer, { fy: FY });
    expect(read.ok).toBe(true);

    const write = await budget$.setBudget(viewer, {
      financialYear: FY,
      kind: 'income',
      category: 'Hundi',
      amount: 1,
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
