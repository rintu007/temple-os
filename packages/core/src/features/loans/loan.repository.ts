import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  loanRepayments,
  loans,
  newId,
  organizations,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { LoanInput, LoanRepaymentInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

// Correlated subqueries use raw identifiers (Drizzle table interpolation
// mis-correlates inside a subquery — see the grants/accounts repositories).

const loanRepaid = sql<string>`coalesce((
  select sum(lr.amount) from loan_repayments lr
  where lr.loan_id = loans.id
), 0)::numeric(14, 2)`;

const loanEmployeeName = sql<string | null>`(
  select e.name from employees e where e.id = loans.employee_id
)`;

export function createLoanRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const loanColumns = {
    id: loans.id,
    direction: loans.direction,
    counterparty: loans.counterparty,
    employeeId: loans.employeeId,
    employeeName: loanEmployeeName,
    title: loans.title,
    status: loans.status,
    disbursedOn: loans.disbursedOn,
    dueOn: loans.dueOn,
    interestRate: loans.interestRate,
    principal: loans.principal,
    repaid: loanRepaid,
  };

  const baseSelect = (tx: Tx) => tx.select(loanColumns).from(loans);

  return {
    async list(ctx: TenantContext, scope: 'active' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where = and(
          eq(loans.organizationId, ctx.organizationId),
          scope === 'active' ? eq(loans.status, 'active') : undefined,
        );
        return baseSelect(tx)
          .where(where)
          .orderBy(asc(loans.status), desc(loans.disbursedOn));
      });
    },

    async findById(ctx: TenantContext, loanId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx).where(eq(loans.id, loanId)).limit(1);
        return row ?? null;
      });
    },

    /** Repayment installments against a loan, newest first, plus org currency. */
    async repayments(ctx: TenantContext, loanId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const rows = await tx
          .select({
            id: loanRepayments.id,
            amount: loanRepayments.amount,
            paidOn: loanRepayments.paidOn,
            note: loanRepayments.note,
          })
          .from(loanRepayments)
          .where(eq(loanRepayments.loanId, loanId))
          .orderBy(desc(loanRepayments.paidOn))
          .limit(500);
        return { currency: org.currency, repayments: rows };
      });
    },

    async create(ctx: TenantContext, input: LoanInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(loans)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            direction: input.direction,
            counterparty: input.counterparty,
            employeeId: input.employeeId ?? null,
            title: input.title ?? null,
            principal: input.principal.toFixed(2),
            interestRate: input.interestRate == null ? null : input.interestRate.toFixed(3),
            disbursedOn: input.disbursedOn,
            dueOn: input.dueOn ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: loans.id });
        if (!row) throw new Error('loan insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'loan.created',
          entityType: 'loan',
          entityId: row.id,
          after: {
            direction: input.direction,
            counterparty: input.counterparty,
            principal: input.principal.toFixed(2),
          },
        });
        return row.id;
      });
    },

    async update(ctx: TenantContext, loanId: string, input: LoanInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(loans)
          .set({
            direction: input.direction,
            counterparty: input.counterparty,
            employeeId: input.employeeId ?? null,
            title: input.title ?? null,
            principal: input.principal.toFixed(2),
            interestRate: input.interestRate == null ? null : input.interestRate.toFixed(3),
            disbursedOn: input.disbursedOn,
            dueOn: input.dueOn ?? null,
            note: input.note ?? null,
          })
          .where(eq(loans.id, loanId))
          .returning({ id: loans.id });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'loan.updated',
          entityType: 'loan',
          entityId: loanId,
          after: { counterparty: input.counterparty },
        });
        return updated.id;
      });
    },

    async setStatus(ctx: TenantContext, loanId: string, status: 'active' | 'closed' | 'written_off') {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(loans)
          .set({ status })
          .where(eq(loans.id, loanId))
          .returning({ id: loans.id, counterparty: loans.counterparty });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: `loan.${status}`,
          entityType: 'loan',
          entityId: loanId,
          after: { counterparty: updated.counterparty, status },
        });
        return updated.id;
      });
    },

    async addRepayment(ctx: TenantContext, loanId: string, input: LoanRepaymentInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(loanRepayments)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            loanId,
            amount: input.amount.toFixed(2),
            paidOn: input.paidOn,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: loanRepayments.id });
        if (!row) throw new Error('loan repayment insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'loan.repayment_recorded',
          entityType: 'loan',
          entityId: loanId,
          after: { amount: input.amount.toFixed(2), paidOn: input.paidOn },
        });
        return row.id;
      });
    },

    async stats(ctx: TenantContext) {
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
            receivable: sql<string>`coalesce(sum(
              case when ${loans.direction} = 'given' then ${loans.principal} - ${loanRepaid} else 0 end
            ), 0)::numeric(14, 2)`,
            payable: sql<string>`coalesce(sum(
              case when ${loans.direction} = 'taken' then ${loans.principal} - ${loanRepaid} else 0 end
            ), 0)::numeric(14, 2)`,
          })
          .from(loans)
          .where(and(eq(loans.organizationId, ctx.organizationId), eq(loans.status, 'active')));
        return {
          currency: org.currency,
          activeCount: row?.activeCount ?? 0,
          receivable: row?.receivable ?? '0.00',
          payable: row?.payable ?? '0.00',
        };
      });
    },

    async exportRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(loans.organizationId, ctx.organizationId))
          .orderBy(asc(loans.direction), desc(loans.disbursedOn)),
      );
    },
  };
}

export type LoanRepository = ReturnType<typeof createLoanRepository>;
