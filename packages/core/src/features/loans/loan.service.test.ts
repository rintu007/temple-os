import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  loanRepayments,
  loans,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createLoanService } from './loan.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('loans: principal/repaid/outstanding (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const loan$ = createLoanService({ db });

  const run = `loan${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let advanceId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(loanRepayments).where(inArray(loanRepayments.organizationId, s));
      await admin.delete(loans).where(inArray(loans.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and registers a staff advance (given)', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('loan test'),
      { name: 'Loan Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await loan$.createLoan(ctx, {
      direction: 'given',
      counterparty: 'Ramesh (Cook)',
      title: 'Festival salary advance',
      principal: 50000,
      disbursedOn: '2026-06-01',
      dueOn: '2026-12-01',
    });
    expect(created.ok).toBe(true);
    if (created.ok) advanceId = created.value.id;
  });

  it('derives repaid and outstanding from the repayment ledger', async () => {
    const r1 = await loan$.recordRepayment(ctx, advanceId, { amount: 20000, paidOn: '2026-07-01' });
    const r2 = await loan$.recordRepayment(ctx, advanceId, { amount: 10000, paidOn: '2026-08-01' });
    expect(r1.ok && r2.ok).toBe(true);

    const detail = await loan$.getLoanDetail(ctx, advanceId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.loan.principal).toBe('50000.00');
    expect(detail.value.loan.repaid).toBe('30000.00');
    expect(detail.value.loan.outstanding).toBe('20000.00');
    expect(detail.value.repayments).toHaveLength(2);
  });

  it('rejects a repayment above the outstanding balance', async () => {
    const over = await loan$.recordRepayment(ctx, advanceId, {
      amount: 25000, // outstanding is only 20000
      paidOn: '2026-09-01',
    });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe('VALIDATION');
  });

  it('splits receivable vs payable across loan directions in stats', async () => {
    await loan$.createLoan(ctx, {
      direction: 'taken',
      counterparty: 'City Co-op Bank',
      title: 'Vehicle loan',
      principal: 200000,
      interestRate: 9.5,
      disbursedOn: '2026-05-01',
    });

    const stats = await loan$.getStats(ctx);
    expect(stats.ok).toBe(true);
    if (!stats.ok) return;
    expect(stats.value.receivable).toBe('20000.00'); // 50000 − 30000 repaid
    expect(stats.value.payable).toBe('200000.00'); // nothing repaid yet
    expect(stats.value.activeCount).toBe(2);
  });

  it('closes a loan and hides it from the active scope', async () => {
    const closed = await loan$.setLoanStatus(ctx, advanceId, 'closed');
    expect(closed.ok).toBe(true);
    const active = await loan$.listLoans(ctx, { scope: 'active' });
    if (active.ok) expect(active.value.find((x) => x.id === advanceId)).toBeUndefined();
    const all = await loan$.listLoans(ctx, { scope: 'all' });
    if (all.ok) expect(all.value.find((x) => x.id === advanceId)).toBeDefined();
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await loan$.listLoans(viewer, { scope: 'all' });
    expect(read.ok).toBe(true);

    const write = await loan$.createLoan(viewer, {
      direction: 'given',
      counterparty: 'X',
      principal: 1,
      disbursedOn: '2026-01-01',
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
