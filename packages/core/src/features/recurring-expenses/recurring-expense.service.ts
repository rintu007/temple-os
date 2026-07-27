import type { Db } from '@templeos/db';
import {
  recurringExpenseListQuerySchema,
  recurringExpenseSchema,
  type RecurringFrequency,
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
import { createRecurringExpenseRepository } from './recurring-expense.repository';
import type {
  RecurringExpenseDetail,
  RecurringExpensePayment,
  RecurringExpenseStats,
  RecurringExpenseSummary,
  RecurringStatus,
} from './recurring-expense.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

const paise = (v: string) => Math.round(Number(v) * 100);
const money = (minor: number) => (minor / 100).toFixed(2);

const parseDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

function stepByFrequency(date: Date, frequency: RecurringFrequency): Date {
  const d = new Date(date);
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  else if (frequency === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

/** Next due date on/after today, or null once ended/paused or past the end date. */
export function computeNextDue(
  frequency: RecurringFrequency,
  startDate: string,
  endDate: string | null,
  status: string,
): string | null {
  if (status !== 'active') return null;
  const today = parseDate(toIso(new Date()));
  const end = endDate ? parseDate(endDate) : null;
  let cur = parseDate(startDate);
  let guard = 0;
  while (cur.getTime() < today.getTime() && guard < 100_000) {
    cur = stepByFrequency(cur, frequency);
    guard += 1;
  }
  if (end && cur.getTime() > end.getTime()) return null;
  return toIso(cur);
}

/** Normalise one cadence amount (in paise) to a monthly-equivalent figure. */
function monthlyEquivalentMinor(amountMinor: number, frequency: RecurringFrequency): number {
  if (frequency === 'weekly') return Math.round((amountMinor * 52) / 12);
  if (frequency === 'quarterly') return Math.round(amountMinor / 3);
  if (frequency === 'annual') return Math.round(amountMinor / 12);
  return amountMinor; // monthly
}

export function createRecurringExpenseService({ db }: { db: Db }) {
  const repo = createRecurringExpenseRepository(db);

  const toSummary = (r: {
    id: string;
    payee: string;
    description: string | null;
    category: string | null;
    amount: string;
    frequency: RecurringFrequency;
    accountId: string | null;
    accountName: string | null;
    startDate: string;
    endDate: string | null;
    status: RecurringStatus;
    paidTotal: string;
    lastPaidAt: Date | null;
  }): RecurringExpenseSummary => ({
    id: r.id,
    payee: r.payee,
    description: r.description,
    category: r.category,
    amount: Number(r.amount).toFixed(2),
    frequency: r.frequency,
    accountId: r.accountId,
    accountName: r.accountName,
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status,
    paidTotal: Number(r.paidTotal).toFixed(2),
    lastPaidAt: r.lastPaidAt ? new Date(r.lastPaidAt) : null,
    nextDue: computeNextDue(r.frequency, r.startDate, r.endDate, r.status),
  });

  return {
    async listRecurring(
      ctx: TenantContext,
      rawQuery: unknown,
    ): Promise<Result<RecurringExpenseSummary[]>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      const parsed = recurringExpenseListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const rows = await repo.list(ctx, parsed.data.scope);
      return ok(rows.map(toSummary));
    },

    async getDetail(ctx: TenantContext, recurringId: string): Promise<Result<RecurringExpenseDetail>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, recurringId);
      if (!row) return err(notFound('Recurring expense'));
      const { currency, payments } = await repo.payments(ctx, recurringId);
      const toPayment = (p: {
        id: string;
        voucherNumber: string;
        amount: string;
        at: Date;
      }): RecurringExpensePayment => ({
        id: p.id,
        voucherNumber: p.voucherNumber,
        amount: Number(p.amount).toFixed(2),
        at: new Date(p.at),
      });
      return ok({ recurring: toSummary(row), currency, payments: payments.map(toPayment) });
    },

    async getStats(ctx: TenantContext): Promise<Result<RecurringExpenseStats>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      const { currency, rows } = await repo.stats(ctx);
      const monthly = rows.reduce(
        (acc, r) => acc + monthlyEquivalentMinor(paise(r.amount), r.frequency),
        0,
      );
      return ok({ currency, activeCount: rows.length, monthlyEquivalent: money(monthly) });
    },

    async createRecurring(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'expenses:write');
      if (!auth.ok) return auth;
      const parsed = recurringExpenseSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.create(ctx, parsed.data);
      return ok({ id });
    },

    async updateRecurring(
      ctx: TenantContext,
      recurringId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'expenses:write');
      if (!auth.ok) return auth;
      const parsed = recurringExpenseSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.update(ctx, recurringId, parsed.data);
      if (!id) return err(notFound('Recurring expense'));
      return ok({ id });
    },

    async setStatus(
      ctx: TenantContext,
      recurringId: string,
      status: RecurringStatus,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'expenses:write');
      if (!auth.ok) return auth;
      const id = await repo.setStatus(ctx, recurringId, status);
      if (!id) return err(notFound('Recurring expense'));
      return ok(null);
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx);
      const header = [
        'Payee',
        'Description',
        'Category',
        'Amount',
        'Frequency',
        'Next due',
        'Paid to date',
        'Status',
      ].join(',');
      const lines = rows.map((r) => {
        const s = toSummary(r);
        return [
          csvField(s.payee),
          csvField(s.description),
          csvField(s.category),
          csvField(s.amount),
          csvField(s.frequency),
          csvField(s.nextDue),
          csvField(s.paidTotal),
          csvField(s.status),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type RecurringExpenseService = ReturnType<typeof createRecurringExpenseService>;
