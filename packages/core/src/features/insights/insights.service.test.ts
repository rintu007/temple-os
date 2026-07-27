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
  expenseCategories,
  expenseCounters,
  expenses,
  investments,
  loans,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDonationService } from '../donations/donation.service';
import { createExpenseService } from '../expenses/expense.service';
import { createInvestmentService } from '../investments/investment.service';
import { createLoanService } from '../loans/loan.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createStatementService } from '../statements/statement.service';
import { createInsightsService } from './insights.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

/** ISO date `offset` days from today (UTC). */
function isoOffset(offset: number): string {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + offset);
  return t.toISOString().slice(0, 10);
}

describe.skipIf(!hasDb)('insights: reminders + analytics + memorandum (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const insights$ = createInsightsService({ db });
  const statement$ = createStatementService({ db });
  const loan$ = createLoanService({ db });
  const investment$ = createInvestmentService({ db });
  const donation$ = createDonationService({ db });
  const expense$ = createExpenseService({ db });

  const run = `ins${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, s));
      await admin.delete(donationCategories).where(inArray(donationCategories.organizationId, s));
      await admin.delete(expenses).where(inArray(expenses.organizationId, s));
      await admin.delete(expenseCounters).where(inArray(expenseCounters.organizationId, s));
      await admin.delete(expenseCategories).where(inArray(expenseCategories.organizationId, s));
      await admin.delete(loans).where(inArray(loans.organizationId, s));
      await admin.delete(investments).where(inArray(investments.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org with a mix of dated records and ledger entries', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('insights test'),
      { name: 'Insights Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    // An overdue loan repayment and an upcoming investment maturity.
    const loan = await loan$.createLoan(ctx, {
      direction: 'given',
      counterparty: 'Affiliated Trust',
      principal: 50000,
      disbursedOn: isoOffset(-60),
      dueOn: isoOffset(-5), // overdue
    });
    const inv = await investment$.createInvestment(ctx, {
      institution: 'SBI',
      type: 'fixed_deposit',
      principal: 100000,
      investedOn: isoOffset(-30),
      maturityDate: isoOffset(10), // upcoming
      maturityValue: 108000,
    });
    expect(loan.ok && inv.ok).toBe(true);

    // Ledger entries in the current financial year.
    const don = await donation$.recordDonation(ctx, {
      donorName: 'Anita Sharma',
      amount: 20000,
      method: 'upi',
      donatedOn: isoOffset(0),
    });
    const exp = await expense$.recordExpense(ctx, {
      paidTo: 'State Electricity Board',
      amount: 5000,
      method: 'bank_transfer',
      categoryName: 'Utilities',
      spentOn: isoOffset(0),
    });
    expect(don.ok && exp.ok).toBe(true);
  });

  it('surfaces overdue-first reminders and financial-year analytics', async () => {
    const result = await insights$.getInsights(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.value;

    // Two reminders, overdue loan first, then the upcoming maturity.
    expect(s.reminders).toHaveLength(2);
    expect(s.reminders[0]?.kind).toBe('loan');
    expect(s.reminders[0]?.overdue).toBe(true);
    expect(s.reminders[0]?.amount).toBe('50000.00');
    expect(s.reminders[1]?.kind).toBe('investment');
    expect(s.reminders[1]?.overdue).toBe(false);
    expect(s.reminders[1]?.amount).toBe('108000.00');
    expect(s.reminderCounts).toEqual({ total: 2, overdue: 1 });

    expect(s.income).toBe('20000.00');
    expect(s.expenditure).toBe('5000.00');
    expect(s.net).toBe('15000.00');
    expect(s.topDonors[0]).toEqual({ label: 'Anita Sharma', total: '20000.00' });
    expect(s.topExpenseCategories.find((c) => c.label === 'Utilities')?.total).toBe('5000.00');
  });

  it('discloses loans and investments as balance-sheet memorandum items', async () => {
    const bs = await statement$.getBalanceSheet(ctx);
    expect(bs.ok).toBe(true);
    if (!bs.ok) return;
    const memo = bs.value.memorandum;
    expect(memo.find((m) => m.label.startsWith('Loans receivable'))?.total).toBe('50000.00');
    expect(memo.find((m) => m.label.startsWith('Investments held'))?.total).toBe('100000.00');
    // Memorandum items are disclosed but never folded into the asset total.
    expect(memo.some((m) => m.label.startsWith('Loans payable'))).toBe(false);
  });

  it('a viewer without reports access cannot read insights', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await insights$.getInsights(viewer);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe('FORBIDDEN');
  });
});
