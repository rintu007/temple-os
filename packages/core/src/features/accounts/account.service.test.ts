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
  financialAccounts,
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
import { createAccountService } from './account.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('accounts: balances + passbook (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const account$ = createAccountService({ db });
  const donation$ = createDonationService({ db });
  const expense$ = createExpenseService({ db });

  const run = `acct${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let accountId = '';

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
      await admin.delete(financialAccounts).where(inArray(financialAccounts.organizationId, s));
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

  it('provisions an org and opens a bank account with an opening balance', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('account test'),
      { name: 'Account Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await account$.createAccount(ctx, {
      name: 'SBI Current',
      type: 'bank',
      bankName: 'State Bank of India',
      accountNumber: '11223344556677',
      openingBalance: 1000,
      openingDate: '2026-04-01',
    });
    expect(created.ok).toBe(true);
    if (created.ok) accountId = created.value.id;
  });

  it('rejects an account number on a cash box', async () => {
    const bad = await account$.createAccount(ctx, {
      name: 'Temple Hundi Cash',
      type: 'cash',
      accountNumber: '999',
      openingBalance: 0,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALIDATION');
  });

  it('derives the balance from opening + receipts − payments', async () => {
    await donation$.recordDonation(ctx, {
      donorName: 'A',
      amount: 5000,
      method: 'bank_transfer',
      accountId,
      donatedOn: '2026-06-10',
    });
    await expense$.recordExpense(ctx, {
      paidTo: 'Electricity Board',
      amount: 1500,
      method: 'bank_transfer',
      accountId,
      spentOn: '2026-06-12',
    });

    const list = await account$.listAccounts(ctx, { scope: 'active' });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const acc = list.value.find((a) => a.id === accountId);
    expect(acc?.openingBalance).toBe('1000.00');
    expect(acc?.received).toBe('5000.00');
    expect(acc?.paid).toBe('1500.00');
    expect(acc?.balance).toBe('4500.00'); // 1000 + 5000 − 1500
    expect(acc?.accountNumberMasked).toBe('••••6677');
  });

  it('stats total the active balances', async () => {
    const stats = await account$.getStats(ctx);
    expect(stats.ok).toBe(true);
    if (stats.ok) {
      expect(stats.value.currency).toBe('INR');
      expect(stats.value.totalBalance).toBe('4500.00');
      expect(stats.value.activeCount).toBe(1);
    }
  });

  it('builds a passbook with a running balance', async () => {
    const pb = await account$.getPassbook(ctx, accountId);
    expect(pb.ok).toBe(true);
    if (!pb.ok) return;
    // Newest first: payment (running 4500), then receipt (running 6000).
    expect(pb.value.movements).toHaveLength(2);
    expect(pb.value.movements[0]?.kind).toBe('payment');
    expect(pb.value.movements[0]?.balance).toBe('4500.00');
    expect(pb.value.movements[1]?.kind).toBe('receipt');
    expect(pb.value.movements[1]?.balance).toBe('6000.00'); // 1000 + 5000
  });

  it('archives an account and hides it from the active scope', async () => {
    const archived = await account$.setAccountActive(ctx, accountId, false);
    expect(archived.ok).toBe(true);

    const active = await account$.listAccounts(ctx, { scope: 'active' });
    if (active.ok) expect(active.value.find((a) => a.id === accountId)).toBeUndefined();

    const all = await account$.listAccounts(ctx, { scope: 'all' });
    if (all.ok) expect(all.value.find((a) => a.id === accountId)).toBeDefined();
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await account$.listAccounts(viewer, { scope: 'all' });
    expect(read.ok).toBe(true);

    const write = await account$.createAccount(viewer, {
      name: 'Nope',
      type: 'cash',
      openingBalance: 0,
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
