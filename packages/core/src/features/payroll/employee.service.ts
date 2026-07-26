import type { Db } from '@templeos/db';
import { employeeListQuerySchema, employeeSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { csvField } from '../reports/report.service';
import { financialYearOf, financialYearRange } from '../statements/statement.service';
import { createEmployeeRepository } from './employee.repository';
import type {
  EmployeeDetail,
  EmployeePayment,
  EmployeeSummary,
  PayrollStats,
} from './employee.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

/** Start of the current India financial year (1 April) as an ISO date string. */
function currentFyStart(): string {
  return financialYearRange(financialYearOf(new Date())).from;
}

type EmployeeRow = {
  id: string;
  name: string;
  designation: string | null;
  employmentType: EmployeeSummary['employmentType'];
  monthlySalary: string | null;
  phone: string | null;
  email: string | null;
  joinedOn: string | null;
  isActive: boolean;
  paidThisFy: string;
  lastPaidAt: Date | null;
};

const toSummary = (e: EmployeeRow): EmployeeSummary => ({
  id: e.id,
  name: e.name,
  designation: e.designation,
  employmentType: e.employmentType,
  monthlySalary: e.monthlySalary == null ? null : Number(e.monthlySalary).toFixed(2),
  phone: e.phone,
  email: e.email,
  joinedOn: e.joinedOn,
  isActive: e.isActive,
  paidThisFy: Number(e.paidThisFy).toFixed(2),
  lastPaidAt: e.lastPaidAt ? new Date(e.lastPaidAt) : null,
});

export function createEmployeeService({ db }: { db: Db }) {
  const repo = createEmployeeRepository(db);

  return {
    async listEmployees(ctx: TenantContext, rawQuery: unknown): Promise<Result<EmployeeSummary[]>> {
      const auth = authorize(ctx, 'payroll:read');
      if (!auth.ok) return auth;
      const parsed = employeeListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const rows = await repo.list(ctx, parsed.data.scope, currentFyStart());
      return ok(rows.map(toSummary));
    },

    /** {id, name} for the employee selector on the expense form. */
    async listActiveOptions(
      ctx: TenantContext,
    ): Promise<Result<Array<{ id: string; name: string }>>> {
      const auth = authorize(ctx, 'payroll:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx, 'active', currentFyStart());
      return ok(rows.map((e) => ({ id: e.id, name: e.name })));
    },

    async getEmployeeDetail(
      ctx: TenantContext,
      employeeId: string,
    ): Promise<Result<EmployeeDetail>> {
      const auth = authorize(ctx, 'payroll:read');
      if (!auth.ok) return auth;
      const employee = await repo.findById(ctx, employeeId, currentFyStart());
      if (!employee) return err(notFound('Employee'));
      const payments = await repo.payments(ctx, employeeId);
      return ok({
        employee: toSummary(employee),
        payments: payments.map(
          (p): EmployeePayment => ({
            id: p.id,
            voucherNumber: p.voucherNumber,
            amount: Number(p.amount).toFixed(2),
            categoryName: p.categoryName,
            at: p.at,
          }),
        ),
      });
    },

    async getStats(ctx: TenantContext): Promise<Result<PayrollStats>> {
      const auth = authorize(ctx, 'payroll:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx, currentFyStart()));
    },

    async createEmployee(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'payroll:write');
      if (!auth.ok) return auth;
      const parsed = employeeSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.create(ctx, parsed.data);
      return ok({ id });
    },

    async updateEmployee(
      ctx: TenantContext,
      employeeId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'payroll:write');
      if (!auth.ok) return auth;
      const parsed = employeeSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.update(ctx, employeeId, parsed.data);
      if (!id) return err(notFound('Employee'));
      return ok({ id });
    },

    async setEmployeeActive(
      ctx: TenantContext,
      employeeId: string,
      isActive: boolean,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'payroll:write');
      if (!auth.ok) return auth;
      const id = await repo.setActive(ctx, employeeId, isActive);
      if (!id) return err(notFound('Employee'));
      return ok(null);
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'payroll:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx, currentFyStart());
      const header = [
        'Name',
        'Designation',
        'Type',
        'Monthly salary',
        'Paid this FY',
        'Status',
      ].join(',');
      const lines = rows.map((r) => {
        const e = toSummary(r);
        return [
          csvField(e.name),
          csvField(e.designation),
          csvField(e.employmentType),
          csvField(e.monthlySalary ?? ''),
          csvField(e.paidThisFy),
          csvField(e.isActive ? 'active' : 'inactive'),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type EmployeeService = ReturnType<typeof createEmployeeService>;
