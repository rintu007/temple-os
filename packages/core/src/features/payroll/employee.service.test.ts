import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  employees,
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
import { createExpenseService } from '../expenses/expense.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createEmployeeService } from './employee.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('payroll: employee register + salary payments (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const employee$ = createEmployeeService({ db });
  const expense$ = createExpenseService({ db });

  const run = `emp${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let employeeId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(expenses).where(inArray(expenses.organizationId, s));
      await admin.delete(expenseCounters).where(inArray(expenseCounters.organizationId, s));
      await admin.delete(expenseCategories).where(inArray(expenseCategories.organizationId, s));
      await admin.delete(employees).where(inArray(employees.organizationId, s));
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

  it('provisions an org and adds an employee', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('payroll test'),
      { name: 'Payroll Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await employee$.createEmployee(ctx, {
      name: 'Ramesh Sharma',
      designation: 'Head Priest',
      employmentType: 'priest',
      monthlySalary: 15000,
      phone: '9876543210',
    });
    expect(created.ok).toBe(true);
    if (created.ok) employeeId = created.value.id;
  });

  it('starts with zero paid and shows the expected monthly salary', async () => {
    const list = await employee$.listEmployees(ctx, { scope: 'active' });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const e = list.value.find((x) => x.id === employeeId);
    expect(e?.monthlySalary).toBe('15000.00');
    expect(e?.paidThisFy).toBe('0.00');
    expect(e?.lastPaidAt).toBeNull();

    const stats = await employee$.getStats(ctx);
    expect(stats.ok && stats.value.monthlyPayroll).toBe('15000.00');
    expect(stats.ok && stats.value.activeCount).toBe(1);
  });

  it('derives paid-this-FY from salary vouchers tagged to the employee', async () => {
    // Two salary payments this FY, tagged to the employee.
    const nowYear = new Date().getUTCMonth() >= 3 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
    const payDate = `${nowYear}-04-15`;
    const p1 = await expense$.recordExpense(ctx, {
      paidTo: 'Ramesh Sharma',
      amount: 15000,
      method: 'bank_transfer',
      categoryName: 'Salaries',
      employeeId,
      spentOn: payDate,
    });
    expect(p1.ok).toBe(true);
    await expense$.recordExpense(ctx, {
      paidTo: 'Ramesh Sharma',
      amount: 15000,
      method: 'bank_transfer',
      categoryName: 'Salaries',
      employeeId,
      spentOn: payDate,
    });

    const detail = await employee$.getEmployeeDetail(ctx, employeeId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.employee.paidThisFy).toBe('30000.00');
    expect(detail.value.employee.lastPaidAt).not.toBeNull();
    expect(detail.value.payments).toHaveLength(2);

    const stats = await employee$.getStats(ctx);
    expect(stats.ok && stats.value.paidThisFy).toBe('30000.00');
  });

  it('deactivates an employee and hides them from the active scope', async () => {
    const done = await employee$.setEmployeeActive(ctx, employeeId, false);
    expect(done.ok).toBe(true);

    const active = await employee$.listEmployees(ctx, { scope: 'active' });
    if (active.ok) expect(active.value.find((x) => x.id === employeeId)).toBeUndefined();
    const all = await employee$.listEmployees(ctx, { scope: 'all' });
    if (all.ok) expect(all.value.find((x) => x.id === employeeId)).toBeDefined();
  });

  it('a manager can read payroll but staff/viewer cannot', async () => {
    const manager: TenantContext = { ...ctx, roleKey: 'manager' };
    const staff: TenantContext = { ...ctx, roleKey: 'staff' };
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };

    expect((await employee$.listEmployees(manager, {})).ok).toBe(true);

    const staffRead = await employee$.listEmployees(staff, {});
    expect(staffRead.ok).toBe(false);
    if (!staffRead.ok) expect(staffRead.error.code).toBe('FORBIDDEN');

    const viewerRead = await employee$.listEmployees(viewer, {});
    expect(viewerRead.ok).toBe(false);
  });
});
