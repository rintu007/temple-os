import type { Db } from '@templeos/db';
import { transferSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { csvField } from '../reports/report.service';
import { createTransferRepository } from './transfer.repository';
import type { TransferStats, TransferSummary } from './transfer.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

export function createTransferService({ db }: { db: Db }) {
  const repo = createTransferRepository(db);

  const toSummary = (t: {
    id: string;
    fromAccountId: string;
    fromAccountName: string;
    toAccountId: string;
    toAccountName: string;
    amount: string;
    transferredOn: string;
    reference: string | null;
    note: string | null;
  }): TransferSummary => ({
    id: t.id,
    fromAccountId: t.fromAccountId,
    fromAccountName: t.fromAccountName,
    toAccountId: t.toAccountId,
    toAccountName: t.toAccountName,
    amount: Number(t.amount).toFixed(2),
    transferredOn: t.transferredOn,
    reference: t.reference,
    note: t.note,
  });

  return {
    async listTransfers(ctx: TenantContext): Promise<Result<TransferSummary[]>> {
      const auth = authorize(ctx, 'accounts:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx);
      return ok(rows.map(toSummary));
    },

    async getStats(ctx: TenantContext): Promise<Result<TransferStats>> {
      const auth = authorize(ctx, 'accounts:read');
      if (!auth.ok) return auth;
      const s = await repo.stats(ctx);
      return ok({ currency: s.currency, count: s.count, total: Number(s.total).toFixed(2) });
    },

    async createTransfer(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'accounts:write');
      if (!auth.ok) return auth;
      const parsed = transferSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      // Both accounts must be active accounts in this tenant. RLS already
      // scopes them to the org; this rejects archived or unknown accounts
      // with a friendly message rather than a foreign-key error.
      const [fromOk, toOk] = await Promise.all([
        repo.isActiveAccount(ctx, parsed.data.fromAccountId),
        repo.isActiveAccount(ctx, parsed.data.toAccountId),
      ]);
      if (!fromOk) return err(domainError('VALIDATION', 'Source account not found'));
      if (!toOk) return err(domainError('VALIDATION', 'Destination account not found'));

      const id = await repo.create(ctx, parsed.data);
      return ok({ id });
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'accounts:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx);
      const header = ['Date', 'From', 'To', 'Amount', 'Reference', 'Note'].join(',');
      const lines = rows.map((r) => {
        const t = toSummary(r);
        return [
          csvField(t.transferredOn),
          csvField(t.fromAccountName),
          csvField(t.toAccountName),
          csvField(t.amount),
          csvField(t.reference),
          csvField(t.note),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type TransferService = ReturnType<typeof createTransferService>;
