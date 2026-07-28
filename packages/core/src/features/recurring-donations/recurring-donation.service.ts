import type { Db } from '@templeos/db';
import {
  recurringDonationListQuerySchema,
  recurringDonationSchema,
  type RecurringDonationFrequency,
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
import { computeNextDue } from '../recurring-expenses/recurring-expense.service';
import { createRecurringDonationRepository } from './recurring-donation.repository';
import type {
  RecurringDonationDetail,
  RecurringDonationPayment,
  RecurringDonationStats,
  RecurringDonationStatus,
  RecurringDonationSummary,
} from './recurring-donation.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

const paise = (v: string) => Math.round(Number(v) * 100);
const money = (minor: number) => (minor / 100).toFixed(2);

/** Normalise one cadence amount (in paise) to a monthly-equivalent figure. */
function monthlyEquivalentMinor(amountMinor: number, frequency: RecurringDonationFrequency): number {
  if (frequency === 'weekly') return Math.round((amountMinor * 52) / 12);
  if (frequency === 'quarterly') return Math.round(amountMinor / 3);
  if (frequency === 'annual') return Math.round(amountMinor / 12);
  return amountMinor; // monthly
}

export function createRecurringDonationService({ db }: { db: Db }) {
  const repo = createRecurringDonationRepository(db);

  const toSummary = (r: {
    id: string;
    donorName: string;
    devoteeId: string | null;
    amount: string;
    frequency: RecurringDonationFrequency;
    fundId: string | null;
    fundName: string | null;
    startDate: string;
    endDate: string | null;
    status: RecurringDonationStatus;
    givenTotal: string;
    lastGivenAt: Date | null;
  }): RecurringDonationSummary => ({
    id: r.id,
    donorName: r.donorName,
    devoteeId: r.devoteeId,
    amount: Number(r.amount).toFixed(2),
    frequency: r.frequency,
    fundId: r.fundId,
    fundName: r.fundName,
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status,
    givenTotal: Number(r.givenTotal).toFixed(2),
    lastGivenAt: r.lastGivenAt ? new Date(r.lastGivenAt) : null,
    nextDue: computeNextDue(r.frequency, r.startDate, r.endDate, r.status),
  });

  return {
    async listRecurring(
      ctx: TenantContext,
      rawQuery: unknown,
    ): Promise<Result<RecurringDonationSummary[]>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const parsed = recurringDonationListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const rows = await repo.list(ctx, parsed.data.scope);
      return ok(rows.map(toSummary));
    },

    async getDetail(
      ctx: TenantContext,
      recurringId: string,
    ): Promise<Result<RecurringDonationDetail>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, recurringId);
      if (!row) return err(notFound('Recurring donation'));
      const { currency, payments } = await repo.payments(ctx, recurringId);
      const toPayment = (p: {
        id: string;
        receiptNumber: string;
        amount: string;
        at: Date;
      }): RecurringDonationPayment => ({
        id: p.id,
        receiptNumber: p.receiptNumber,
        amount: Number(p.amount).toFixed(2),
        at: new Date(p.at),
      });
      return ok({ recurring: toSummary(row), currency, payments: payments.map(toPayment) });
    },

    async getStats(ctx: TenantContext): Promise<Result<RecurringDonationStats>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const { currency, rows } = await repo.stats(ctx);
      const monthly = rows.reduce(
        (acc, r) => acc + monthlyEquivalentMinor(paise(r.amount), r.frequency),
        0,
      );
      return ok({ currency, activeCount: rows.length, monthlyEquivalent: money(monthly) });
    },

    async createRecurring(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;
      const parsed = recurringDonationSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.create(ctx, parsed.data);
      if (result.kind === 'devotee_not_found') return err(notFound('Devotee'));
      if (result.kind === 'no_donor') {
        return err(domainError('VALIDATION', 'Select a devotee or enter a donor name'));
      }
      return ok({ id: result.id });
    },

    async updateRecurring(
      ctx: TenantContext,
      recurringId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;
      const parsed = recurringDonationSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.update(ctx, recurringId, parsed.data);
      if (result.kind === 'devotee_not_found') return err(notFound('Devotee'));
      if (result.kind === 'no_donor') {
        return err(domainError('VALIDATION', 'Select a devotee or enter a donor name'));
      }
      if (result.kind === 'not_found') return err(notFound('Recurring donation'));
      return ok({ id: result.id });
    },

    async setStatus(
      ctx: TenantContext,
      recurringId: string,
      status: RecurringDonationStatus,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;
      const id = await repo.setStatus(ctx, recurringId, status);
      if (!id) return err(notFound('Recurring donation'));
      return ok(null);
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx);
      const header = [
        'Donor',
        'Fund',
        'Amount',
        'Frequency',
        'Next due',
        'Given to date',
        'Status',
      ].join(',');
      const lines = rows.map((r) => {
        const s = toSummary(r);
        return [
          csvField(s.donorName),
          csvField(s.fundName),
          csvField(s.amount),
          csvField(s.frequency),
          csvField(s.nextDue),
          csvField(s.givenTotal),
          csvField(s.status),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type RecurringDonationService = ReturnType<typeof createRecurringDonationService>;
