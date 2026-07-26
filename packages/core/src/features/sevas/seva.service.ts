import type { Db } from '@templeos/db';
import { sevaListQuerySchema, sevaSubscriptionSchema } from '@templeos/validators';
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
import { createSevaRepository } from './seva.repository';
import type { SevaDetail, SevaFrequency, SevaStats, SevaSummary } from './seva.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

const parseDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

function stepByFrequency(date: Date, frequency: SevaFrequency): Date {
  const d = new Date(date);
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  else if (frequency === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

/** The next occurrence on/after today, or null once ended/past the end date. */
function computeNextOccurrence(
  frequency: SevaFrequency,
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

type SevaRow = {
  id: string;
  sponsorName: string;
  devoteeId: string | null;
  sevaName: string;
  amount: string;
  frequency: SevaFrequency;
  occasion: string | null;
  startDate: string;
  endDate: string | null;
  status: SevaSummary['status'];
  collected: string;
  lastPaidAt: Date | null;
};

const toSummary = (s: SevaRow): SevaSummary => ({
  id: s.id,
  sponsorName: s.sponsorName,
  devoteeId: s.devoteeId,
  sevaName: s.sevaName,
  amount: Number(s.amount).toFixed(2),
  frequency: s.frequency,
  occasion: s.occasion,
  startDate: s.startDate,
  endDate: s.endDate,
  status: s.status,
  collected: Number(s.collected).toFixed(2),
  lastPaidAt: s.lastPaidAt ? new Date(s.lastPaidAt) : null,
  nextOccurrence: computeNextOccurrence(s.frequency, s.startDate, s.endDate, s.status),
});

export function createSevaService({ db }: { db: Db }) {
  const repo = createSevaRepository(db);

  return {
    async listSevas(ctx: TenantContext, rawQuery: unknown): Promise<Result<SevaSummary[]>> {
      const auth = authorize(ctx, 'sevas:read');
      if (!auth.ok) return auth;
      const parsed = sevaListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const rows = await repo.list(ctx, parsed.data.scope);
      return ok(rows.map(toSummary));
    },

    async getSevaDetail(ctx: TenantContext, sevaId: string): Promise<Result<SevaDetail>> {
      const auth = authorize(ctx, 'sevas:read');
      if (!auth.ok) return auth;
      const seva = await repo.findById(ctx, sevaId);
      if (!seva) return err(notFound('Seva'));
      const { currency, rows } = await repo.payments(ctx, sevaId);
      return ok({
        seva: toSummary(seva),
        currency,
        payments: rows.map((p) => ({
          id: p.id,
          receiptNumber: p.receiptNumber,
          amount: Number(p.amount).toFixed(2),
          at: p.at,
        })),
      });
    },

    async getStats(ctx: TenantContext): Promise<Result<SevaStats>> {
      const auth = authorize(ctx, 'sevas:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx));
    },

    async createSeva(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'sevas:write');
      if (!auth.ok) return auth;
      const parsed = sevaSubscriptionSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.create(ctx, parsed.data);
      if (result.kind === 'devotee_not_found') return err(notFound('Devotee'));
      return ok({ id: result.id });
    },

    async updateSeva(
      ctx: TenantContext,
      sevaId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'sevas:write');
      if (!auth.ok) return auth;
      const parsed = sevaSubscriptionSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.update(ctx, sevaId, parsed.data);
      if (!id) return err(notFound('Seva'));
      return ok({ id });
    },

    async setSevaStatus(
      ctx: TenantContext,
      sevaId: string,
      status: 'active' | 'paused' | 'ended',
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'sevas:write');
      if (!auth.ok) return auth;
      const id = await repo.setStatus(ctx, sevaId, status);
      if (!id) return err(notFound('Seva'));
      return ok(null);
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'sevas:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx);
      const header = [
        'Sponsor',
        'Seva',
        'Amount',
        'Frequency',
        'Occasion',
        'Next occurrence',
        'Collected',
        'Status',
      ].join(',');
      const lines = rows.map((r) => {
        const s = toSummary(r);
        return [
          csvField(s.sponsorName),
          csvField(s.sevaName),
          csvField(s.amount),
          csvField(s.frequency),
          csvField(s.occasion),
          csvField(s.nextOccurrence ?? ''),
          csvField(s.collected),
          csvField(s.status),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type SevaService = ReturnType<typeof createSevaService>;
