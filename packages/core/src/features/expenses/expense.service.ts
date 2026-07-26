import type { Db } from '@templeos/db';
import {
  expenseApprovalSettingsSchema,
  expenseListQuerySchema,
  recordExpenseSchema,
  rejectExpenseSchema,
  voidExpenseSchema,
} from '@templeos/validators';
import {
  authorize,
  conflict,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { csvField } from '../reports/report.service';
import { createExpenseRepository } from './expense.repository';
import type {
  ExpenseApprovalSettings,
  ExpensePage,
  ExpenseStats,
  ExpenseSummary,
} from './expense.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

export function createExpenseService({ db }: { db: Db }) {
  const repo = createExpenseRepository(db);

  const toSummary = (e: {
    id: string;
    voucherNumber: string;
    paidTo: string;
    categoryName?: string | null;
    amount: string;
    currency: 'INR' | 'BDT';
    method: ExpenseSummary['method'];
    reference: string | null;
    note: string | null;
    spentAt: Date;
    status: 'recorded' | 'void';
    voidReason: string | null;
    approvalStatus?: ExpenseSummary['approvalStatus'];
    rejectionReason?: string | null;
  }): ExpenseSummary => ({
    id: e.id,
    voucherNumber: e.voucherNumber,
    paidTo: e.paidTo,
    categoryName: e.categoryName ?? null,
    amount: e.amount,
    currency: e.currency,
    method: e.method,
    reference: e.reference,
    note: e.note,
    spentAt: e.spentAt,
    status: e.status,
    voidReason: e.voidReason,
    approvalStatus: e.approvalStatus ?? 'not_required',
    rejectionReason: e.rejectionReason ?? null,
  });

  return {
    async recordExpense(ctx: TenantContext, rawInput: unknown): Promise<Result<ExpenseSummary>> {
      const auth = authorize(ctx, 'expenses:write');
      if (!auth.ok) return auth;
      const parsed = recordExpenseSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const expense = await repo.record(ctx, parsed.data);
      return ok(toSummary({ ...expense, categoryName: parsed.data.categoryName ?? null }));
    },

    async listExpenses(ctx: TenantContext, rawQuery: unknown): Promise<Result<ExpensePage>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      const parsed = expenseListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const query = { ...parsed.data, search: parsed.data.search ?? null };

      const { items, total } = await repo.list(ctx, query);
      return ok({
        items: items.map(toSummary),
        total,
        page: query.page,
        pageSize: query.pageSize,
      });
    },

    async getExpense(ctx: TenantContext, expenseId: string): Promise<Result<ExpenseSummary>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, expenseId);
      if (!row) return err(notFound('Expense'));
      return ok(toSummary(row));
    },

    /** Voiding keeps the row and voucher number — the books stay continuous. */
    async voidExpense(
      ctx: TenantContext,
      expenseId: string,
      rawInput: unknown,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'expenses:void');
      if (!auth.ok) return auth;
      const parsed = voidExpenseSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const result = await repo.void(ctx, expenseId, parsed.data.reason);
      if (result.kind === 'not_found') return err(notFound('Expense'));
      if (result.kind === 'already_void') return err(conflict('This expense is already void'));
      return ok(null);
    },

    async getStats(ctx: TenantContext): Promise<Result<ExpenseStats>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx));
    },

    /** Recorded-only expense total for a range — for the reports net figure. */
    async getRangeSummary(
      ctx: TenantContext,
      range: { from: string; to: string },
    ): Promise<Result<{ total: string; count: number }>> {
      const auth = authorize(ctx, 'reports:read');
      if (!auth.ok) return auth;
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      const from = datePattern.test(range.from) ? range.from : null;
      const to = datePattern.test(range.to) ? range.to : null;
      return ok(await repo.rangeSummary(ctx, from, to));
    },

    /** Voucher-book export for the range (includes voided rows, marked). */
    async exportCsv(
      ctx: TenantContext,
      range: { from: string; to: string },
    ): Promise<Result<string>> {
      const auth = authorize(ctx, 'reports:read');
      if (!auth.ok) return auth;
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      const from = datePattern.test(range.from) ? range.from : null;
      const to = datePattern.test(range.to) ? range.to : null;

      const rows = await repo.exportRows(ctx, from, to);
      const header = [
        'Voucher No',
        'Date',
        'Paid To',
        'Category',
        'Method',
        'Reference',
        'Amount',
        'Currency',
        'Status',
        'Void Reason',
        'Note',
      ].join(',');

      const lines = rows.map((r) =>
        [
          csvField(r.voucherNumber),
          csvField(r.spentAt.toISOString().slice(0, 10)),
          csvField(r.paidTo),
          csvField(r.categoryName),
          csvField(r.method),
          csvField(r.reference),
          csvField(r.amount),
          csvField(r.currency),
          csvField(r.status),
          csvField(r.voidReason),
          csvField(r.note),
        ].join(','),
      );

      return ok([header, ...lines].join('\r\n') + '\r\n');
    },

    /** Expenses awaiting sign-off — the approvals queue. */
    async listPendingApprovals(ctx: TenantContext): Promise<Result<ExpenseSummary[]>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      const rows = await repo.listPending(ctx);
      return ok(rows.map(toSummary));
    },

    async getPendingApprovalCount(ctx: TenantContext): Promise<Result<number>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      return ok(await repo.pendingCount(ctx));
    },

    async approveExpense(ctx: TenantContext, expenseId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'expenses:approve');
      if (!auth.ok) return auth;
      const result = await repo.decide(ctx, expenseId, 'approved', null);
      if (result.kind === 'not_found') return err(notFound('Expense'));
      if (result.kind === 'not_pending') return err(conflict('This expense is not awaiting approval'));
      return ok(null);
    },

    async rejectExpense(
      ctx: TenantContext,
      expenseId: string,
      rawInput: unknown,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'expenses:approve');
      if (!auth.ok) return auth;
      const parsed = rejectExpenseSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.decide(ctx, expenseId, 'rejected', parsed.data.reason);
      if (result.kind === 'not_found') return err(notFound('Expense'));
      if (result.kind === 'not_pending') return err(conflict('This expense is not awaiting approval'));
      return ok(null);
    },

    async getApprovalSettings(ctx: TenantContext): Promise<Result<ExpenseApprovalSettings>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      return ok(await repo.getApprovalThreshold(ctx));
    },

    async setApprovalSettings(ctx: TenantContext, rawInput: unknown): Promise<Result<null>> {
      const auth = authorize(ctx, 'expenses:approve');
      if (!auth.ok) return auth;
      const parsed = expenseApprovalSettingsSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const threshold =
        parsed.data.threshold == null ? null : Number(parsed.data.threshold).toFixed(2);
      await repo.setApprovalThreshold(ctx, threshold);
      return ok(null);
    },
  };
}

export type ExpenseService = ReturnType<typeof createExpenseService>;
