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
  fundTransfers,
  funds,
  memberships,
  platformSubscriptions,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDonationService } from '../donations/donation.service';
import { createFundService } from '../funds/fund.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createStatementService } from '../statements/statement.service';
import { createFundTransferService } from './fund-transfer.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('fund transfers: reallocate between funds (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const fund$ = createFundService({ db });
  const transfer$ = createFundTransferService({ db });
  const donation$ = createDonationService({ db });
  const statement$ = createStatementService({ db });

  const run = `ftr${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let corpusId = '';
  let buildingId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(fundTransfers).where(inArray(fundTransfers.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, s));
      await admin.delete(donationCategories).where(inArray(donationCategories.organizationId, s));
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

  it('provisions an org, two funds and seeds the corpus', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('fund transfer test'),
      { name: 'Fund Xfer Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const corpus = await fund$.createFund(ctx, { name: 'Corpus' });
    const building = await fund$.createFund(ctx, { name: 'Building' });
    expect(corpus.ok && building.ok).toBe(true);
    if (corpus.ok) corpusId = corpus.value.id;
    if (building.ok) buildingId = building.value.id;

    const don = await donation$.recordDonation(ctx, {
      donorName: 'Patron',
      amount: 100000,
      method: 'bank_transfer',
      fundId: corpusId,
      donatedOn: '2026-06-01',
    });
    expect(don.ok).toBe(true);
  });

  it('rejects a transfer to the same fund', async () => {
    const bad = await transfer$.createTransfer(ctx, {
      fromFundId: corpusId,
      toFundId: corpusId,
      amount: 100,
      transferredOn: '2026-06-05',
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALIDATION');
  });

  it('moves the balance between funds, org total unchanged', async () => {
    const made = await transfer$.createTransfer(ctx, {
      fromFundId: corpusId,
      toFundId: buildingId,
      amount: 30000,
      transferredOn: '2026-06-10',
      reference: 'Board resolution 12',
    });
    expect(made.ok).toBe(true);

    const list = await fund$.listFunds(ctx, { scope: 'active' });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value.find((f) => f.id === corpusId)?.balance).toBe('70000.00'); // 100000 − 30000
    expect(list.value.find((f) => f.id === buildingId)?.balance).toBe('30000.00');

    // Transfers net to zero across funds — the total is unchanged.
    const stats = await fund$.getStats(ctx);
    expect(stats.ok && stats.value.totalBalance).toBe('100000.00');
  });

  it('shows the transfer in the fund ledger', async () => {
    const detail = await fund$.getFundDetail(ctx, buildingId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.transfers).toHaveLength(1);
    expect(detail.value.transfers[0]?.kind).toBe('transfer_in');
    expect(detail.value.transfers[0]?.party).toBe('from Corpus');
    expect(detail.value.transfers[0]?.amount).toBe('30000.00');
  });

  it('folds transfers into the balance-sheet earmarked funds', async () => {
    const bs = await statement$.getBalanceSheet(ctx);
    expect(bs.ok).toBe(true);
    if (!bs.ok) return;
    expect(bs.value.funds.find((f) => f.label === 'Corpus')?.total).toBe('70000.00');
    expect(bs.value.funds.find((f) => f.label === 'Building')?.total).toBe('30000.00');
    // The two sides still agree.
    const liabPlusFunds = Number(bs.value.liabilitiesTotal) + Number(bs.value.fundsTotal);
    expect(liabPlusFunds.toFixed(2)).toBe(bs.value.assetsTotal);
  });

  it('lists transfers and exposes counterparty fund names', async () => {
    const list = await transfer$.listTransfers(ctx);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value).toHaveLength(1);
    expect(list.value[0]?.fromFundName).toBe('Corpus');
    expect(list.value[0]?.toFundName).toBe('Building');
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await transfer$.listTransfers(viewer);
    expect(read.ok).toBe(true);

    const write = await transfer$.createTransfer(viewer, {
      fromFundId: corpusId,
      toFundId: buildingId,
      amount: 1,
      transferredOn: '2026-01-01',
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
