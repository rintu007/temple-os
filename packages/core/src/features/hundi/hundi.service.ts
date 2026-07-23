import type { Db } from '@templeos/db';
import { computeHundiTotal, recordHundiCollectionSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createHundiRepository } from './hundi.repository';
import type { DenominationLine, HundiCollectionSummary } from './hundi.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

function toSummary(row: {
  id: string;
  boxName: string;
  countedOn: string;
  denominations: DenominationLine[] | null;
  totalAmount: string;
  currency: 'INR' | 'BDT';
  note: string | null;
  receiptNumber: string;
  status: 'recorded' | 'void';
  createdAt: Date;
}): HundiCollectionSummary {
  return {
    id: row.id,
    boxName: row.boxName,
    countedOn: row.countedOn,
    denominations: row.denominations,
    totalAmount: row.totalAmount,
    currency: row.currency,
    note: row.note,
    receiptNumber: row.receiptNumber,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function createHundiService({ db }: { db: Db }) {
  const repo = createHundiRepository(db);

  return {
    async listCollections(ctx: TenantContext): Promise<Result<HundiCollectionSummary[]>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx);
      return ok(
        rows.map((r) =>
          toSummary({ ...r, receiptNumber: r.receiptNumber ?? '', status: r.status ?? 'recorded' }),
        ),
      );
    },

    async recordCollection(
      ctx: TenantContext,
      rawInput: unknown,
    ): Promise<Result<HundiCollectionSummary>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;

      const parsed = recordHundiCollectionSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const denomTotal = parsed.data.denominations
        ? computeHundiTotal(parsed.data.denominations)
        : 0;
      const total = denomTotal > 0 ? denomTotal : (parsed.data.amount ?? 0);

      const result = await repo.record(ctx, parsed.data, total);
      if (result.kind === 'temple_not_found') return err(notFound('Temple'));

      return ok(
        toSummary({
          ...result.collection,
          receiptNumber: result.receiptNumber,
          status: 'recorded',
        }),
      );
    },
  };
}

export type HundiService = ReturnType<typeof createHundiService>;
