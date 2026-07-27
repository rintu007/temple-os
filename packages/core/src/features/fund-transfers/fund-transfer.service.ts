import type { Db } from '@templeos/db';
import { fundTransferSchema } from '@templeos/validators';
import { authorize, domainError, err, ok, type Result, type TenantContext } from '../../shared';
import { csvField } from '../reports/report.service';
import { createFundTransferRepository } from './fund-transfer.repository';
import type { FundTransferStats, FundTransferSummary } from './fund-transfer.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

export function createFundTransferService({ db }: { db: Db }) {
  const repo = createFundTransferRepository(db);

  const toSummary = (t: {
    id: string;
    fromFundId: string;
    fromFundName: string;
    toFundId: string;
    toFundName: string;
    amount: string;
    transferredOn: string;
    reference: string | null;
    note: string | null;
  }): FundTransferSummary => ({
    id: t.id,
    fromFundId: t.fromFundId,
    fromFundName: t.fromFundName,
    toFundId: t.toFundId,
    toFundName: t.toFundName,
    amount: Number(t.amount).toFixed(2),
    transferredOn: t.transferredOn,
    reference: t.reference,
    note: t.note,
  });

  return {
    async listTransfers(ctx: TenantContext): Promise<Result<FundTransferSummary[]>> {
      const auth = authorize(ctx, 'funds:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx);
      return ok(rows.map(toSummary));
    },

    async getStats(ctx: TenantContext): Promise<Result<FundTransferStats>> {
      const auth = authorize(ctx, 'funds:read');
      if (!auth.ok) return auth;
      const s = await repo.stats(ctx);
      return ok({ currency: s.currency, count: s.count, total: Number(s.total).toFixed(2) });
    },

    async createTransfer(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'funds:write');
      if (!auth.ok) return auth;
      const parsed = fundTransferSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const [fromOk, toOk] = await Promise.all([
        repo.isActiveFund(ctx, parsed.data.fromFundId),
        repo.isActiveFund(ctx, parsed.data.toFundId),
      ]);
      if (!fromOk) return err(domainError('VALIDATION', 'Source fund not found'));
      if (!toOk) return err(domainError('VALIDATION', 'Destination fund not found'));

      const id = await repo.create(ctx, parsed.data);
      return ok({ id });
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'funds:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx);
      const header = ['Date', 'From fund', 'To fund', 'Amount', 'Reference', 'Note'].join(',');
      const lines = rows.map((r) => {
        const t = toSummary(r);
        return [
          csvField(t.transferredOn),
          csvField(t.fromFundName),
          csvField(t.toFundName),
          csvField(t.amount),
          csvField(t.reference),
          csvField(t.note),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type FundTransferService = ReturnType<typeof createFundTransferService>;
