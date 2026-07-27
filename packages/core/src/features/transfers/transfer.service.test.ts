import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  accountReconciliations,
  accountTransfers,
  auditLogs,
  createDb,
  domains,
  financialAccounts,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createAccountService } from '../accounts/account.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createReconciliationService } from '../reconciliation/reconciliation.service';
import { createTransferService } from './transfer.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('transfers: move money between accounts (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const account$ = createAccountService({ db });
  const transfer$ = createTransferService({ db });
  const recon$ = createReconciliationService({ db });

  const run = `xfer${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let bankId = '';
  let cashId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(accountTransfers).where(inArray(accountTransfers.organizationId, s));
      await admin
        .delete(accountReconciliations)
        .where(inArray(accountReconciliations.organizationId, s));
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

  it('provisions an org and two accounts', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('transfer test'),
      { name: 'Transfer Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const bank = await account$.createAccount(ctx, {
      name: 'SBI Current',
      type: 'bank',
      openingBalance: 100000,
    });
    const cash = await account$.createAccount(ctx, {
      name: 'Cash Box',
      type: 'cash',
      openingBalance: 5000,
    });
    expect(bank.ok && cash.ok).toBe(true);
    if (bank.ok) bankId = bank.value.id;
    if (cash.ok) cashId = cash.value.id;
  });

  it('rejects a transfer to the same account', async () => {
    const bad = await transfer$.createTransfer(ctx, {
      fromAccountId: bankId,
      toAccountId: bankId,
      amount: 100,
      transferredOn: '2026-06-01',
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALIDATION');
  });

  it('moves the balance on both accounts, org total unchanged', async () => {
    const made = await transfer$.createTransfer(ctx, {
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: 30000,
      transferredOn: '2026-06-10',
      reference: 'Cash withdrawal',
    });
    expect(made.ok).toBe(true);

    const bank = await account$.getPassbook(ctx, bankId);
    const cash = await account$.getPassbook(ctx, cashId);
    expect(bank.ok && bank.value.account.balance).toBe('70000.00'); // 100000 − 30000
    expect(cash.ok && cash.value.account.balance).toBe('35000.00'); // 5000 + 30000

    if (bank.ok) {
      const m = bank.value.movements.find((x) => x.kind === 'transfer_out');
      expect(m?.party).toBe('to Cash Box');
      expect(m?.amount).toBe('30000.00');
    }
    if (cash.ok) {
      const m = cash.value.movements.find((x) => x.kind === 'transfer_in');
      expect(m?.party).toBe('from SBI Current');
    }

    // Transfers net to zero across the org — total balance is unchanged.
    const stats = await account$.getStats(ctx);
    expect(stats.ok && stats.value.totalBalance).toBe('105000.00'); // 100000 + 5000
  });

  it('reconciliation reflects the transfer and clears the source side', async () => {
    const before = await recon$.getReconciliation(ctx, bankId);
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.bookBalance).toBe('70000.00'); // opening − transfer out
    expect(before.value.clearedBalance).toBe('100000.00'); // nothing cleared yet
    expect(before.value.unclearedPayments).toBe('30000.00');
    const entry = before.value.entries.find((e) => e.kind === 'transfer_out');
    expect(entry).toBeDefined();

    if (entry) {
      const cleared = await recon$.setCleared(ctx, {
        kind: 'transfer_out',
        entryId: entry.id,
        cleared: true,
      });
      expect(cleared.ok).toBe(true);
    }

    const after = await recon$.getReconciliation(ctx, bankId);
    expect(after.ok && after.value.clearedBalance).toBe('70000.00'); // now cleared
    expect(after.ok && after.value.unclearedPayments).toBe('0.00');
  });

  it('lists transfers and exposes the counterparty names', async () => {
    const list = await transfer$.listTransfers(ctx);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value).toHaveLength(1);
    expect(list.value[0]?.fromAccountName).toBe('SBI Current');
    expect(list.value[0]?.toAccountName).toBe('Cash Box');

    const stats = await transfer$.getStats(ctx);
    expect(stats.ok && stats.value.count).toBe(1);
    expect(stats.ok && stats.value.total).toBe('30000.00');
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await transfer$.listTransfers(viewer);
    expect(read.ok).toBe(true);

    const write = await transfer$.createTransfer(viewer, {
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: 1,
      transferredOn: '2026-01-01',
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
