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
  funds,
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
import { createFundService } from './fund.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('funds: earmarked accounting (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const funds$ = createFundService({ db });
  const donations$ = createDonationService({ db });
  const expenses$ = createExpenseService({ db });

  const run = `fnd${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let fundId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(expenses).where(inArray(expenses.organizationId, s));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, s));
      await admin.delete(expenseCounters).where(inArray(expenseCounters.organizationId, s));
      await admin.delete(donationCategories).where(inArray(donationCategories.organizationId, s));
      await admin.delete(expenseCategories).where(inArray(expenseCategories.organizationId, s));
      await admin.delete(funds).where(inArray(funds.organizationId, s));
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

  it('provisions an org and creates a fund', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('fund test'),
      { name: 'Fund Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await funds$.createFund(ctx, { name: 'Building Fund', description: 'New hall' });
    expect(created.ok).toBe(true);
    if (created.ok) fundId = created.value.id;
  });

  it('derives balance from earmarked donations and expenses', async () => {
    const d1 = await donations$.recordDonation(ctx, {
      amount: 5000,
      method: 'cash',
      donorName: 'Donor A',
      fundId,
    });
    expect(d1.ok).toBe(true);
    await donations$.recordDonation(ctx, { amount: 3000, method: 'upi', donorName: 'Donor B', fundId });
    // An un-earmarked donation must NOT count toward the fund.
    await donations$.recordDonation(ctx, { amount: 9999, method: 'cash', donorName: 'Donor C' });
    await expenses$.recordExpense(ctx, { amount: 2000, method: 'cash', paidTo: 'Builder', fundId });

    const detail = await funds$.getFundDetail(ctx, fundId);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.value.fund.income).toBe('8000.00');
      expect(detail.value.fund.expense).toBe('2000.00');
      expect(detail.value.fund.balance).toBe('6000.00');
      expect(detail.value.income).toHaveLength(2);
      expect(detail.value.expenditure).toHaveLength(1);
    }
  });

  it('reports fund stats', async () => {
    const stats = await funds$.getStats(ctx);
    expect(stats.ok).toBe(true);
    if (stats.ok) {
      expect(stats.value.currency).toBe('INR');
      expect(stats.value.totalBalance).toBe('6000.00');
      expect(stats.value.activeCount).toBe(1);
    }
  });

  it('lists funds and offers active options', async () => {
    const list = await funds$.listFunds(ctx, { scope: 'active' });
    expect(list.ok && list.value).toHaveLength(1);

    const options = await funds$.listActiveOptions(ctx);
    expect(options.ok && options.value[0]?.name).toBe('Building Fund');
  });

  it('renames and deactivates a fund', async () => {
    const updated = await funds$.updateFund(ctx, fundId, { name: 'Hall Construction Fund' });
    expect(updated.ok).toBe(true);

    const deactivated = await funds$.setFundActive(ctx, fundId, false);
    expect(deactivated.ok).toBe(true);

    const active = await funds$.listFunds(ctx, { scope: 'active' });
    expect(active.ok && active.value).toHaveLength(0);

    const all = await funds$.listFunds(ctx, { scope: 'all' });
    expect(all.ok && all.value).toHaveLength(1);
  });

  it('exports a CSV and blocks a viewer from writing', async () => {
    const csv = await funds$.exportCsv(ctx);
    expect(csv.ok).toBe(true);
    if (csv.ok) {
      expect(csv.value).toContain('Fund,Description,Income,Expense,Balance,Status');
      expect(csv.value).toContain('Hall Construction Fund');
    }

    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await funds$.listFunds(viewer, { scope: 'all' });
    expect(read.ok).toBe(true);

    const write = await funds$.createFund(viewer, { name: 'Nope Fund' });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
