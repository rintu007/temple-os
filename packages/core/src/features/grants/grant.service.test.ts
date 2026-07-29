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
  grants,
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
import { createGrantService } from './grant.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('grants: sanctioned/received/utilized (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const grant$ = createGrantService({ db });
  const donation$ = createDonationService({ db });
  const expense$ = createExpenseService({ db });

  const run = `grant${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let grantId = '';

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
      await admin.delete(grants).where(inArray(grants.organizationId, s));
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

  it('provisions an org and registers a grant', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('grant test'),
      { name: 'Grant Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await grant$.createGrant(ctx, {
      funder: 'HR&CE Department',
      title: 'Temple Renovation Scheme 2026',
      reference: 'GO-Ms-142',
      sanctionedAmount: 500000,
      sanctionedOn: '2026-05-01',
      purpose: 'Gopuram restoration',
    });
    expect(created.ok).toBe(true);
    if (created.ok) grantId = created.value.id;
  });

  it('derives received, utilized and unspent from the ledger', async () => {
    // Grant released in two tranches, partly utilized.
    await donation$.recordDonation(ctx, {
      donorName: 'HR&CE Department',
      amount: 300000,
      method: 'bank_transfer',
      grantId,
      donatedOn: '2026-06-01',
    });
    await expense$.recordExpense(ctx, {
      paidTo: 'Sthapathi Works',
      amount: 120000,
      method: 'bank_transfer',
      categoryName: 'Repairs & Maintenance',
      grantId,
      spentOn: '2026-06-15',
    });

    const list = await grant$.listGrants(ctx, { scope: 'active' });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const g = list.value.find((x) => x.id === grantId);
    expect(g?.sanctionedAmount).toBe('500000.00');
    expect(g?.received).toBe('300000.00');
    expect(g?.utilized).toBe('120000.00');
    expect(g?.unspent).toBe('180000.00'); // 300000 − 120000
    expect(g?.pendingRelease).toBe('200000.00'); // 500000 − 300000
  });

  it('exposes the grant ledger with receipts and utilizations', async () => {
    const detail = await grant$.getGrantDetail(ctx, grantId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.receipts).toHaveLength(1);
    expect(detail.value.receipts[0]?.amount).toBe('300000.00');
    expect(detail.value.utilizations).toHaveLength(1);
    expect(detail.value.utilizations[0]?.amount).toBe('120000.00');

    const stats = await grant$.getStats(ctx);
    expect(stats.ok && stats.value.totalUnspent).toBe('180000.00');
    expect(stats.ok && stats.value.activeCount).toBe(1);
  });

  it('closes a grant and hides it from the active scope', async () => {
    const closed = await grant$.setGrantStatus(ctx, grantId, 'closed');
    expect(closed.ok).toBe(true);
    const active = await grant$.listGrants(ctx, { scope: 'active' });
    if (active.ok) expect(active.value.find((x) => x.id === grantId)).toBeUndefined();
    const all = await grant$.listGrants(ctx, { scope: 'all' });
    if (all.ok) expect(all.value.find((x) => x.id === grantId)).toBeDefined();
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await grant$.listGrants(viewer, { scope: 'all' });
    expect(read.ok).toBe(true);

    const write = await grant$.createGrant(viewer, {
      funder: 'X',
      title: 'Y',
      sanctionedAmount: 1,
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
