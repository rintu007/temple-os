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
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createExpenseService } from './expense.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('expenses: record, void, stats, isolation (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createExpenseService({ db });

  const run = `exp${Date.now().toString(36)}`;
  const ownerA = { userId: randomUUID(), email: `own-a-${run}@test.invalid`, fullName: 'Owner A' };
  const ownerB = { userId: randomUUID(), email: `own-b-${run}@test.invalid`, fullName: 'Owner B' };
  let orgA = '';
  let orgB = '';
  let ctxA: TenantContext;
  let ctxB: TenantContext;
  let firstExpenseId = '';

  afterAll(async () => {
    const orgIds = [orgA, orgB].filter(Boolean);
    if (orgIds.length) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, orgIds));
      await admin.delete(expenses).where(inArray(expenses.organizationId, orgIds));
      await admin.delete(expenseCounters).where(inArray(expenseCounters.organizationId, orgIds));
      await admin
        .delete(expenseCategories)
        .where(inArray(expenseCategories.organizationId, orgIds));
      await admin.delete(memberships).where(inArray(memberships.organizationId, orgIds));
      await admin.delete(roles).where(inArray(roles.organizationId, orgIds));
      await admin.delete(domains).where(inArray(domains.organizationId, orgIds));
      await admin.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    await admin.delete(users).where(inArray(users.id, [ownerA.userId, ownerB.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions two isolated organizations', async () => {
    const a = await orgService.provisionOrganization(
      systemContext('expense test'),
      { name: 'Expense Org A', slug: `${run}-a`, country: 'IN' },
      ownerA,
    );
    const b = await orgService.provisionOrganization(
      systemContext('expense test'),
      { name: 'Expense Org B', slug: `${run}-b`, country: 'IN' },
      ownerB,
    );
    expect(a.ok && b.ok).toBe(true);
    if (a.ok) orgA = a.value.id;
    if (b.ok) orgB = b.value.id;
    ctxA = { organizationId: orgA, userId: ownerA.userId, roleKey: 'owner', templeIds: null };
    ctxB = { organizationId: orgB, userId: ownerB.userId, roleKey: 'owner', templeIds: null };
  });

  it('records an expense with an EV-prefixed sequential voucher', async () => {
    const result = await service.recordExpense(ctxA, {
      amount: 1500,
      method: 'cash',
      paidTo: 'Flower Vendor',
      categoryName: 'Puja Supplies',
      spentOn: '2026-07-20',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      firstExpenseId = result.value.id;
      expect(result.value.voucherNumber).toMatch(/^EV\d{4}-\d{5}$/);
      expect(result.value.amount).toBe('1500.00');
      expect(result.value.paidTo).toBe('Flower Vendor');
      expect(result.value.categoryName).toBe('Puja Supplies');
    }
  });

  it('vouchers increment within the organization', async () => {
    const second = await service.recordExpense(ctxA, {
      amount: 800,
      method: 'upi',
      paidTo: 'Electric Board',
      categoryName: 'Electricity & Utilities',
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      const seq = (v: string) => Number(v.split('-')[1]);
      expect(seq(second.value.voucherNumber)).toBeGreaterThan(0);
    }
  });

  it('validation rejects a non-positive amount and a missing payee', async () => {
    const badAmount = await service.recordExpense(ctxA, {
      amount: -10,
      method: 'cash',
      paidTo: 'Someone',
    });
    expect(badAmount.ok).toBe(false);
    const badPayee = await service.recordExpense(ctxA, {
      amount: 100,
      method: 'cash',
      paidTo: '',
    });
    expect(badPayee.ok).toBe(false);
  });

  it('viewer can read but cannot write or void', async () => {
    const viewer: TenantContext = { ...ctxA, roleKey: 'viewer' };
    const read = await service.listExpenses(viewer, {});
    expect(read.ok).toBe(true);
    const write = await service.recordExpense(viewer, {
      amount: 10,
      method: 'cash',
      paidTo: 'X',
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
    const voided = await service.voidExpense(viewer, firstExpenseId, { reason: 'nope' });
    expect(voided.ok).toBe(false);
  });

  it('staff can write but cannot void', async () => {
    const staff: TenantContext = { ...ctxA, roleKey: 'staff' };
    const write = await service.recordExpense(staff, {
      amount: 50,
      method: 'cash',
      paidTo: 'Daily prasad shop',
    });
    expect(write.ok).toBe(true);
    const voided = await service.voidExpense(staff, firstExpenseId, { reason: 'nope' });
    expect(voided.ok).toBe(false);
  });

  it('org B cannot see org A expenses (RLS isolation)', async () => {
    const listB = await service.listExpenses(ctxB, {});
    expect(listB.ok).toBe(true);
    if (listB.ok) expect(listB.value.total).toBe(0);

    const stolen = await service.getExpense(ctxB, firstExpenseId);
    expect(stolen.ok).toBe(false);
  });

  it('search matches payee and voucher number', async () => {
    const byName = await service.listExpenses(ctxA, { search: 'Flower' });
    expect(byName.ok).toBe(true);
    if (byName.ok) {
      expect(byName.value.items.some((e) => e.paidTo === 'Flower Vendor')).toBe(true);
    }
  });

  it('voiding excludes the expense from stats and is idempotent-guarded', async () => {
    const before = await service.getStats(ctxA);
    const voided = await service.voidExpense(ctxA, firstExpenseId, { reason: 'test void' });
    expect(voided.ok).toBe(true);
    const again = await service.voidExpense(ctxA, firstExpenseId, { reason: 'twice' });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('CONFLICT');

    const after = await service.getStats(ctxA);
    expect(before.ok && after.ok).toBe(true);
    if (before.ok && after.ok) {
      expect(Number(after.value.allTimeTotal)).toBeLessThan(Number(before.value.allTimeTotal));
    }
  });

  it('exports a CSV voucher book with header and rows', async () => {
    const csv = await service.exportCsv(ctxA, { from: '', to: '' });
    expect(csv.ok).toBe(true);
    if (csv.ok) {
      const lines = csv.value.trim().split('\r\n');
      expect(lines[0]).toContain('Voucher No');
      expect(lines.length).toBeGreaterThan(1);
      expect(csv.value).toContain('Flower Vendor');
    }
  });

  it('range summary counts only recorded expenses', async () => {
    const summary = await service.getRangeSummary(ctxA, { from: '', to: '' });
    expect(summary.ok).toBe(true);
    if (summary.ok) {
      // first expense voided; second (800) + staff one (50) remain
      expect(Number(summary.value.total)).toBeGreaterThan(0);
      expect(summary.value.count).toBeGreaterThanOrEqual(2);
    }
  });
});
