import type { Db } from '@templeos/db';
import { dateRangeSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createReportRepository } from './report.repository';
import type { DonationReport } from './report.types';

/** RFC 4180 field escaping: quote when the value contains comma/quote/newline. */
export function csvField(value: string | null | undefined): string {
  const v = value ?? '';
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

export function createReportService({ db }: { db: Db }) {
  const repo = createReportRepository(db);

  return {
    async getDonationReport(ctx: TenantContext, rawRange: unknown): Promise<Result<DonationReport>> {
      const auth = authorize(ctx, 'reports:read');
      if (!auth.ok) return auth;
      const parsed = dateRangeSchema.safeParse(rawRange ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const from = parsed.data.from ?? null;
      const to = parsed.data.to ?? null;

      const summary = await repo.donationSummary(ctx, from, to);
      return ok({ ...summary, from, to });
    },

    /** Full ledger export for the range (includes voided rows, marked). */
    async exportDonationsCsv(ctx: TenantContext, rawRange: unknown): Promise<Result<string>> {
      const auth = authorize(ctx, 'reports:read');
      if (!auth.ok) return auth;
      const parsed = dateRangeSchema.safeParse(rawRange ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const from = parsed.data.from ?? null;
      const to = parsed.data.to ?? null;

      const rows = await repo.donationRows(ctx, from, to);
      const header = [
        'Receipt No',
        'Date',
        'Donor',
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
          csvField(r.receiptNumber),
          csvField(r.donatedAt.toISOString().slice(0, 10)),
          csvField(r.donorName),
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
  };
}

export type ReportService = ReturnType<typeof createReportService>;
