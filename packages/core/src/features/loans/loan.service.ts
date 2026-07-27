import type { Db } from '@templeos/db';
import {
  loanListQuerySchema,
  loanRepaymentSchema,
  loanSchema,
  type LoanStatus,
} from '@templeos/validators';
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
import { createLoanRepository } from './loan.repository';
import type { LoanDetail, LoanRepaymentEntry, LoanStats, LoanSummary } from './loan.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

const paise = (v: string) => Math.round(Number(v) * 100);
const money = (minor: number) => (minor / 100).toFixed(2);

export function createLoanService({ db }: { db: Db }) {
  const repo = createLoanRepository(db);

  const toSummary = (l: {
    id: string;
    direction: 'given' | 'taken';
    counterparty: string;
    employeeId: string | null;
    employeeName: string | null;
    title: string | null;
    status: LoanStatus;
    disbursedOn: string;
    dueOn: string | null;
    interestRate: string | null;
    principal: string;
    repaid: string;
  }): LoanSummary => {
    const principal = paise(l.principal);
    const repaid = paise(l.repaid);
    return {
      id: l.id,
      direction: l.direction,
      counterparty: l.counterparty,
      employeeId: l.employeeId,
      employeeName: l.employeeName,
      title: l.title,
      status: l.status,
      disbursedOn: l.disbursedOn,
      dueOn: l.dueOn,
      interestRate: l.interestRate == null ? null : Number(l.interestRate).toString(),
      principal: money(principal),
      repaid: money(repaid),
      outstanding: money(Math.max(0, principal - repaid)),
    };
  };

  return {
    async listLoans(ctx: TenantContext, rawQuery: unknown): Promise<Result<LoanSummary[]>> {
      const auth = authorize(ctx, 'loans:read');
      if (!auth.ok) return auth;
      const parsed = loanListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const rows = await repo.list(ctx, parsed.data.scope);
      return ok(rows.map(toSummary));
    },

    async getLoanDetail(ctx: TenantContext, loanId: string): Promise<Result<LoanDetail>> {
      const auth = authorize(ctx, 'loans:read');
      if (!auth.ok) return auth;
      const loan = await repo.findById(ctx, loanId);
      if (!loan) return err(notFound('Loan'));
      const { currency, repayments } = await repo.repayments(ctx, loanId);
      const toEntry = (r: {
        id: string;
        amount: string;
        paidOn: string;
        note: string | null;
      }): LoanRepaymentEntry => ({
        id: r.id,
        amount: Number(r.amount).toFixed(2),
        paidOn: r.paidOn,
        note: r.note,
      });
      return ok({ loan: toSummary(loan), currency, repayments: repayments.map(toEntry) });
    },

    async getStats(ctx: TenantContext): Promise<Result<LoanStats>> {
      const auth = authorize(ctx, 'loans:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx));
    },

    async createLoan(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'loans:write');
      if (!auth.ok) return auth;
      const parsed = loanSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.create(ctx, parsed.data);
      return ok({ id });
    },

    async updateLoan(
      ctx: TenantContext,
      loanId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'loans:write');
      if (!auth.ok) return auth;
      const parsed = loanSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.update(ctx, loanId, parsed.data);
      if (!id) return err(notFound('Loan'));
      return ok({ id });
    },

    async setLoanStatus(
      ctx: TenantContext,
      loanId: string,
      status: LoanStatus,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'loans:write');
      if (!auth.ok) return auth;
      const id = await repo.setStatus(ctx, loanId, status);
      if (!id) return err(notFound('Loan'));
      return ok(null);
    },

    async recordRepayment(
      ctx: TenantContext,
      loanId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'loans:write');
      if (!auth.ok) return auth;
      const parsed = loanRepaymentSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const loan = await repo.findById(ctx, loanId);
      if (!loan) return err(notFound('Loan'));

      // Repayments cannot exceed what is still owed (guard against typos).
      const outstanding = Math.max(0, paise(loan.principal) - paise(loan.repaid));
      if (paise(String(parsed.data.amount)) > outstanding) {
        return err(
          domainError(
            'VALIDATION',
            `Repayment exceeds the outstanding balance of ${money(outstanding)}`,
          ),
        );
      }

      const id = await repo.addRepayment(ctx, loanId, parsed.data);
      return ok({ id });
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'loans:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx);
      const header = [
        'Direction',
        'Counterparty',
        'Title',
        'Disbursed',
        'Due',
        'Principal',
        'Repaid',
        'Outstanding',
        'Status',
      ].join(',');
      const lines = rows.map((r) => {
        const l = toSummary(r);
        return [
          csvField(l.direction === 'given' ? 'Given (receivable)' : 'Taken (payable)'),
          csvField(l.counterparty),
          csvField(l.title),
          csvField(l.disbursedOn),
          csvField(l.dueOn),
          csvField(l.principal),
          csvField(l.repaid),
          csvField(l.outstanding),
          csvField(l.status),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type LoanService = ReturnType<typeof createLoanService>;
