import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  accountReconciliations,
  auditLogs,
  createDb,
  domains,
  donationCounters,
  donations,
  expenseCounters,
  expenses,
  financialAccounts,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createAccountService } from '../accounts/account.service';
import { createDonationService } from '../donations/donation.service';
import { createExpenseService } from '../expenses/expense.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createReconciliationService } from './reconciliation.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('reconciliation: bank rec (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const account$ = createAccountService({ db });
  const donation$ = createDonationService({ db });
  const expense$ = createExpenseService({ db });
  const recon$ = createReconciliationService({ db });

  const run = `recon${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let accountId = '';
  let receiptId = '';
  let paymentId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(accountReconciliations).where(inArray(accountReconciliations.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, s));
      await admin.delete(expenses).where(inArray(expenses.organizationId, s));
      await admin.delete(expenseCounters).where(inArray(expenseCounters.organizationId, s));
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

  it('provisions an org, an account and two tagged entries', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('recon test'),
      { name: 'Recon Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const acc = await account$.createAccount(ctx, {
      name: 'SBI Current',
      type: 'bank',
      openingBalance: 1000,
    });
    expect(acc.ok).toBe(true);
    if (acc.ok) accountId = acc.value.id;

    const rec = await donation$.recordDonation(ctx, {
      donorName: 'A',
      amount: 5000,
      method: 'bank_transfer',
      accountId,
      donatedOn: '2026-06-10',
    });
    if (rec.ok) receiptId = rec.value.id;
    const pay = await expense$.recordExpense(ctx, {
      paidTo: 'Vendor',
      amount: 2000,
      method: 'bank_transfer',
      accountId,
      spentOn: '2026-06-12',
    });
    if (pay.ok) paymentId = pay.value.id;
  });

  it('starts with everything uncleared: book balance set, cleared = opening only', async () => {
    const view = await recon$.getReconciliation(ctx, accountId);
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value.bookBalance).toBe('4000.00'); // 1000 + 5000 − 2000
    expect(view.value.clearedBalance).toBe('1000.00'); // opening only
    expect(view.value.unclearedReceipts).toBe('5000.00');
    expect(view.value.unclearedPayments).toBe('2000.00');
    expect(view.value.entries).toHaveLength(2);
    expect(view.value.entries.every((e) => !e.cleared)).toBe(true);
  });

  it('clearing the receipt moves it into the cleared balance', async () => {
    const done = await recon$.setCleared(ctx, {
      kind: 'receipt',
      entryId: receiptId,
      cleared: true,
    });
    expect(done.ok).toBe(true);

    const view = await recon$.getReconciliation(ctx, accountId);
    if (!view.ok) return;
    expect(view.value.clearedBalance).toBe('6000.00'); // 1000 + 5000
    expect(view.value.unclearedReceipts).toBe('0.00');
    expect(view.value.unclearedPayments).toBe('2000.00');
    // Cleared entries sort after uncleared ones.
    expect(view.value.entries[0]?.cleared).toBe(false);
  });

  it('records a reconciliation with the difference vs the statement', async () => {
    // Clear the payment too → cleared balance becomes 4000.
    await recon$.setCleared(ctx, { kind: 'payment', entryId: paymentId, cleared: true });

    // Statement says 4000 → difference 0 (fully reconciled).
    const rec = await recon$.recordReconciliation(ctx, accountId, {
      statementDate: '2026-06-30',
      statementBalance: 4000,
    });
    expect(rec.ok).toBe(true);
    if (rec.ok) expect(rec.value.difference).toBe('0.00');

    const view = await recon$.getReconciliation(ctx, accountId);
    if (view.ok) {
      expect(view.value.clearedBalance).toBe('4000.00');
      expect(view.value.lastReconciliation?.statementBalance).toBe('4000.00');
      expect(view.value.lastReconciliation?.difference).toBe('0.00');
    }
  });

  it('un-clearing an entry works and a viewer cannot write', async () => {
    const undo = await recon$.setCleared(ctx, {
      kind: 'receipt',
      entryId: receiptId,
      cleared: false,
    });
    expect(undo.ok).toBe(true);

    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await recon$.getReconciliation(viewer, accountId);
    expect(read.ok).toBe(true); // viewer has accounts:read

    const write = await recon$.setCleared(viewer, {
      kind: 'payment',
      entryId: paymentId,
      cleared: true,
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
