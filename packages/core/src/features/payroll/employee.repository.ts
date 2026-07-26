import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  employees,
  expenseCategories,
  expenses,
  newId,
  organizations,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { EmployeeInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

// Correlated subqueries use raw identifiers (Drizzle table interpolation
// mis-correlates inside a subquery — see the funds/accounts repositories).

const lastPaidAt = sql<Date | null>`(
  select max(e.spent_at) from expenses e
  where e.employee_id = employees.id and e.status = 'recorded'
)`;

/** Salary/honorarium paid to this employee since a FY-start boundary (ISO date). */
const paidSince = (fyStart: string) => sql<string>`coalesce((
  select sum(e.amount) from expenses e
  where e.employee_id = employees.id and e.status = 'recorded' and e.spent_at >= ${fyStart}::timestamptz
), 0)::numeric(12, 2)`;

export function createEmployeeRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const columns = (fyStart: string) => ({
    id: employees.id,
    name: employees.name,
    designation: employees.designation,
    employmentType: employees.employmentType,
    monthlySalary: employees.monthlySalary,
    phone: employees.phone,
    email: employees.email,
    joinedOn: employees.joinedOn,
    isActive: employees.isActive,
    paidThisFy: paidSince(fyStart),
    lastPaidAt,
  });

  return {
    async list(ctx: TenantContext, scope: 'active' | 'all', fyStart: string) {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where = and(
          eq(employees.organizationId, ctx.organizationId),
          scope === 'active' ? eq(employees.isActive, true) : undefined,
        );
        return tx
          .select(columns(fyStart))
          .from(employees)
          .where(where)
          .orderBy(desc(employees.isActive), asc(employees.name));
      });
    },

    async findById(ctx: TenantContext, employeeId: string, fyStart: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select(columns(fyStart))
          .from(employees)
          .where(eq(employees.id, employeeId))
          .limit(1);
        return row ?? null;
      });
    },

    /** Recorded salary vouchers paid to an employee — the payment history. */
    async payments(ctx: TenantContext, employeeId: string) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select({
            id: expenses.id,
            voucherNumber: expenses.voucherNumber,
            amount: expenses.amount,
            categoryName: expenseCategories.name,
            at: expenses.spentAt,
          })
          .from(expenses)
          .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
          .where(and(eq(expenses.employeeId, employeeId), eq(expenses.status, 'recorded')))
          .orderBy(desc(expenses.spentAt))
          .limit(200),
      );
    },

    async create(ctx: TenantContext, input: EmployeeInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(employees)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            name: input.name,
            designation: input.designation ?? null,
            employmentType: input.employmentType,
            monthlySalary: input.monthlySalary == null ? null : input.monthlySalary.toFixed(2),
            phone: input.phone ?? null,
            email: input.email ?? null,
            joinedOn: input.joinedOn ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: employees.id });
        if (!row) throw new Error('employee insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'employee.created',
          entityType: 'employee',
          entityId: row.id,
          after: { name: input.name, employmentType: input.employmentType },
        });
        return row.id;
      });
    },

    async update(ctx: TenantContext, employeeId: string, input: EmployeeInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(employees)
          .set({
            name: input.name,
            designation: input.designation ?? null,
            employmentType: input.employmentType,
            monthlySalary: input.monthlySalary == null ? null : input.monthlySalary.toFixed(2),
            phone: input.phone ?? null,
            email: input.email ?? null,
            joinedOn: input.joinedOn ?? null,
            note: input.note ?? null,
          })
          .where(eq(employees.id, employeeId))
          .returning({ id: employees.id });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'employee.updated',
          entityType: 'employee',
          entityId: employeeId,
          after: { name: input.name },
        });
        return updated.id;
      });
    },

    async setActive(ctx: TenantContext, employeeId: string, isActive: boolean) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(employees)
          .set({ isActive })
          .where(eq(employees.id, employeeId))
          .returning({ id: employees.id, name: employees.name });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: isActive ? 'employee.reactivated' : 'employee.deactivated',
          entityType: 'employee',
          entityId: employeeId,
          after: { name: updated.name, isActive },
        });
        return updated.id;
      });
    },

    async stats(ctx: TenantContext, fyStart: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const [row] = await tx
          .select({
            activeCount: count(),
            monthlyPayroll: sql<string>`coalesce(sum(${employees.monthlySalary}), 0)::numeric(12, 2)`,
          })
          .from(employees)
          .where(and(eq(employees.organizationId, ctx.organizationId), eq(employees.isActive, true)));

        const [paid] = await tx
          .select({
            total: sql<string>`coalesce(sum(${expenses.amount}), 0)::numeric(12, 2)`,
          })
          .from(expenses)
          .where(
            and(
              eq(expenses.organizationId, ctx.organizationId),
              eq(expenses.status, 'recorded'),
              sql`${expenses.employeeId} is not null`,
              sql`${expenses.spentAt} >= ${fyStart}::timestamptz`,
            ),
          );

        return {
          currency: org.currency,
          activeCount: row?.activeCount ?? 0,
          monthlyPayroll: row?.monthlyPayroll ?? '0.00',
          paidThisFy: paid?.total ?? '0.00',
        };
      });
    },

    async exportRows(ctx: TenantContext, fyStart: string) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select(columns(fyStart))
          .from(employees)
          .where(eq(employees.organizationId, ctx.organizationId))
          .orderBy(asc(employees.name)),
      );
    },
  };
}

export type EmployeeRepository = ReturnType<typeof createEmployeeRepository>;
