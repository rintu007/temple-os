import type { Db } from '@templeos/db';
import {
  inKindDonationSchema,
  inKindListQuerySchema,
  setDispositionSchema,
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
import { createInKindRepository } from './in-kind.repository';
import type { InKindStats, InKindSummary } from './in-kind.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

type InKindRow = {
  id: string;
  donorName: string;
  devoteeId: string | null;
  category: InKindSummary['category'];
  item: string;
  quantity: string | null;
  unit: string | null;
  estimatedValue: string | null;
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  receivedOn: string;
  disposition: InKindSummary['disposition'];
  disposalNote: string | null;
  note: string | null;
};

const toSummary = (r: InKindRow): InKindSummary => ({
  id: r.id,
  donorName: r.donorName,
  devoteeId: r.devoteeId,
  category: r.category,
  item: r.item,
  quantity: r.quantity == null ? null : Number(r.quantity).toString(),
  unit: r.unit,
  estimatedValue: r.estimatedValue == null ? null : Number(r.estimatedValue).toFixed(2),
  currency: r.currency,
  receivedOn: r.receivedOn,
  disposition: r.disposition,
  disposalNote: r.disposalNote,
  note: r.note,
});

export function createInKindService({ db }: { db: Db }) {
  const repo = createInKindRepository(db);

  return {
    async listInKind(ctx: TenantContext, rawQuery: unknown): Promise<Result<InKindSummary[]>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const parsed = inKindListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const rows = await repo.list(ctx, parsed.data.scope);
      return ok(rows.map(toSummary));
    },

    async getInKind(ctx: TenantContext, inKindId: string): Promise<Result<InKindSummary>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, inKindId);
      if (!row) return err(notFound('Offering'));
      return ok(toSummary(row));
    },

    async getStats(ctx: TenantContext): Promise<Result<InKindStats>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx));
    },

    async recordInKind(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;
      const parsed = inKindDonationSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.create(ctx, parsed.data);
      if (result.kind === 'devotee_not_found') return err(notFound('Devotee'));
      return ok({ id: result.id });
    },

    async updateInKind(
      ctx: TenantContext,
      inKindId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;
      const parsed = inKindDonationSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.update(ctx, inKindId, parsed.data);
      if (!id) return err(notFound('Offering'));
      return ok({ id });
    },

    async setDisposition(
      ctx: TenantContext,
      inKindId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;
      const parsed = setDispositionSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.setDisposition(ctx, inKindId, parsed.data);
      if (!id) return err(notFound('Offering'));
      return ok({ id });
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx);
      const header = [
        'Received',
        'Donor',
        'Category',
        'Item',
        'Quantity',
        'Unit',
        'Estimated value',
        'Disposition',
      ].join(',');
      const lines = rows.map((r) => {
        const s = toSummary(r);
        return [
          csvField(s.receivedOn),
          csvField(s.donorName),
          csvField(s.category),
          csvField(s.item),
          csvField(s.quantity ?? ''),
          csvField(s.unit ?? ''),
          csvField(s.estimatedValue ?? ''),
          csvField(s.disposition),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type InKindService = ReturnType<typeof createInKindService>;
