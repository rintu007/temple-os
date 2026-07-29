import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
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
import { createOrganizationService } from '../organizations/organization.service';
import { createExpenseService } from './expense.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('expenses: approval workflow (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createExpenseService({ db });

  const run = `exa${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let pendingId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
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

  it('provisions an org and sets an approval threshold', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('approval test'),
      { name: 'Approval Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const set = await service.setApprovalSettings(ctx, { threshold: '5000' });
    expect(set.ok).toBe(true);

    const settings = await service.getApprovalSettings(ctx);
    expect(settings.ok && settings.value.threshold).toBe('5000.00');
  });

  it('records below-threshold as not_required and at/above as pending', async () => {
    const small = await service.recordExpense(ctx, { amount: 3000, method: 'cash', paidTo: 'Flowers' });
    expect(small.ok).toBe(true);
    if (small.ok) expect(small.value.approvalStatus).toBe('not_required');

    const big = await service.recordExpense(ctx, { amount: 5000, method: 'bank_transfer', paidTo: 'Contractor' });
    expect(big.ok).toBe(true);
    if (big.ok) {
      expect(big.value.approvalStatus).toBe('pending');
      pendingId = big.value.id;
    }
  });

  it('lists the pending queue and approves one', async () => {
    const pending = await service.listPendingApprovals(ctx);
    expect(pending.ok && pending.value).toHaveLength(1);

    const countBefore = await service.getPendingApprovalCount(ctx);
    expect(countBefore.ok && countBefore.value).toBe(1);

    const approved = await service.approveExpense(ctx, pendingId);
    expect(approved.ok).toBe(true);

    const after = await service.listPendingApprovals(ctx);
    expect(after.ok && after.value).toHaveLength(0);

    const expense = await service.getExpense(ctx, pendingId);
    expect(expense.ok && expense.value.approvalStatus).toBe('approved');
  });

  it('rejects an expense with a reason', async () => {
    const big = await service.recordExpense(ctx, { amount: 9000, method: 'cheque', paidTo: 'Vendor X' });
    expect(big.ok).toBe(true);
    const id = big.ok ? big.value.id : '';

    const rejected = await service.rejectExpense(ctx, id, { reason: 'No quote attached' });
    expect(rejected.ok).toBe(true);

    const expense = await service.getExpense(ctx, id);
    if (expense.ok) {
      expect(expense.value.approvalStatus).toBe('rejected');
      expect(expense.value.rejectionReason).toBe('No quote attached');
    }

    // Re-deciding a resolved expense is a conflict.
    const again = await service.approveExpense(ctx, id);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('CONFLICT');
  });

  it('lets staff record but not approve', async () => {
    const staff: TenantContext = { ...ctx, roleKey: 'staff' };
    const recorded = await service.recordExpense(staff, { amount: 6000, method: 'cash', paidTo: 'Repairs' });
    expect(recorded.ok).toBe(true);
    const id = recorded.ok ? recorded.value.id : '';
    if (recorded.ok) expect(recorded.value.approvalStatus).toBe('pending');

    const approve = await service.approveExpense(staff, id);
    expect(approve.ok).toBe(false);
    if (!approve.ok) expect(approve.error.code).toBe('FORBIDDEN');

    const settings = await service.setApprovalSettings(staff, { threshold: '1' });
    expect(settings.ok).toBe(false);
  });

  it('clearing the threshold disables the workflow', async () => {
    const cleared = await service.setApprovalSettings(ctx, { threshold: '' });
    expect(cleared.ok).toBe(true);

    const any = await service.recordExpense(ctx, { amount: 99999, method: 'cash', paidTo: 'Anything' });
    expect(any.ok).toBe(true);
    if (any.ok) expect(any.value.approvalStatus).toBe('not_required');
  });
});
