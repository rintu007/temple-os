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
  recurringExpenses,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createExpenseService } from '../expenses/expense.service';
import { createInsightsService } from '../insights/insights.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createRecurringExpenseService } from './recurring-expense.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

const todayIso = () => new Date().toISOString().slice(0, 10);

describe.skipIf(!hasDb)('recurring expenses: schedule + derived payments (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const recurring$ = createRecurringExpenseService({ db });
  const expense$ = createExpenseService({ db });
  const insights$ = createInsightsService({ db });

  const run = `rec${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let rentId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(expenses).where(inArray(expenses.organizationId, s));
      await admin.delete(expenseCounters).where(inArray(expenseCounters.organizationId, s));
      await admin.delete(expenseCategories).where(inArray(expenseCategories.organizationId, s));
      await admin.delete(recurringExpenses).where(inArray(recurringExpenses.organizationId, s));
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

  it('provisions an org and adds a monthly standing order', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('recurring test'),
      { name: 'Recurring Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await recurring$.createRecurring(ctx, {
      payee: 'Landlord',
      description: 'Office rent',
      category: 'Rent',
      amount: 10000,
      frequency: 'monthly',
      startDate: todayIso(), // next due is today
    });
    expect(created.ok).toBe(true);
    if (created.ok) rentId = created.value.id;

    const list = await recurring$.listRecurring(ctx, { scope: 'active' });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const r = list.value.find((x) => x.id === rentId);
    expect(r?.nextDue).toBe(todayIso());
    expect(r?.paidTotal).toBe('0.00');
  });

  it('derives paid-to-date from expense vouchers tagged to it', async () => {
    const paid = await expense$.recordExpense(ctx, {
      paidTo: 'Landlord',
      amount: 10000,
      method: 'bank_transfer',
      categoryName: 'Rent',
      recurringExpenseId: rentId,
      spentOn: todayIso(),
    });
    expect(paid.ok).toBe(true);

    const detail = await recurring$.getDetail(ctx, rentId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.recurring.paidTotal).toBe('10000.00');
    expect(detail.value.recurring.lastPaidAt).not.toBeNull();
    expect(detail.value.payments).toHaveLength(1);
    expect(detail.value.payments[0]?.amount).toBe('10000.00');
  });

  it('reports a monthly-equivalent commitment across cadences', async () => {
    await recurring$.createRecurring(ctx, {
      payee: 'Temple Trust FD',
      description: 'Annual insurance',
      amount: 12000,
      frequency: 'annual',
      startDate: todayIso(),
    });
    const stats = await recurring$.getStats(ctx);
    expect(stats.ok).toBe(true);
    if (!stats.ok) return;
    expect(stats.value.activeCount).toBe(2);
    // 10000 monthly + 12000/12 annual = 11000
    expect(stats.value.monthlyEquivalent).toBe('11000.00');
  });

  it('surfaces the due standing order in insights reminders', async () => {
    const ins = await insights$.getInsights(ctx);
    expect(ins.ok).toBe(true);
    if (!ins.ok) return;
    const reminder = ins.value.reminders.find(
      (r) => r.kind === 'recurring_expense' && r.title === 'Landlord',
    );
    expect(reminder).toBeDefined();
    expect(reminder?.amount).toBe('10000.00');
  });

  it('pausing clears the next-due date and hides it from active scope', async () => {
    const paused = await recurring$.setStatus(ctx, rentId, 'paused');
    expect(paused.ok).toBe(true);
    const detail = await recurring$.getDetail(ctx, rentId);
    expect(detail.ok && detail.value.recurring.nextDue).toBeNull();
    const active = await recurring$.listRecurring(ctx, { scope: 'active' });
    if (active.ok) expect(active.value.find((x) => x.id === rentId)).toBeUndefined();
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await recurring$.listRecurring(viewer, { scope: 'all' });
    expect(read.ok).toBe(true);

    const write = await recurring$.createRecurring(viewer, {
      payee: 'X',
      amount: 1,
      frequency: 'monthly',
      startDate: todayIso(),
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
