import type { Db } from '@templeos/db';
import { recordReconciliationSchema, setClearedSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createReconciliationRepository } from './reconciliation.repository';
import type { ReconcileEntry, ReconciliationView } from './reconciliation.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

const paise = (v: string) => Math.round(Number(v) * 100);
const money = (minor: number) => (minor / 100).toFixed(2);

export function createReconciliationService({ db }: { db: Db }) {
  const repo = createReconciliationRepository(db);

  async function computeClearedBalance(
    ctx: TenantContext,
    accountId: string,
  ): Promise<number | null> {
    const data = await repo.reconcileData(ctx, accountId);
    if (!data) return null;
    return (
      paise(data.account.openingBalance) +
      paise(data.receiptSums.cleared) -
      paise(data.paymentSums.cleared)
    );
  }

  return {
    async getReconciliation(
      ctx: TenantContext,
      accountId: string,
    ): Promise<Result<ReconciliationView>> {
      const auth = authorize(ctx, 'accounts:read');
      if (!auth.ok) return auth;

      const data = await repo.reconcileData(ctx, accountId);
      if (!data) return err(notFound('Account'));

      const opening = paise(data.account.openingBalance);
      const totalR = paise(data.receiptSums.total);
      const clearedR = paise(data.receiptSums.cleared);
      const totalP = paise(data.paymentSums.total);
      const clearedP = paise(data.paymentSums.cleared);

      const entries: ReconcileEntry[] = [
        ...data.receipts.map((r) => ({
          kind: 'receipt' as const,
          id: r.id,
          ref: r.ref,
          party: r.party,
          amount: Number(r.amount).toFixed(2),
          at: r.at,
          cleared: r.clearedAt != null,
        })),
        ...data.payments.map((p) => ({
          kind: 'payment' as const,
          id: p.id,
          ref: p.ref,
          party: p.party,
          amount: Number(p.amount).toFixed(2),
          at: p.at,
          cleared: p.clearedAt != null,
        })),
      ];
      // Uncleared first (the actionable items), then newest first.
      entries.sort((a, b) => {
        if (a.cleared !== b.cleared) return a.cleared ? 1 : -1;
        return b.at.getTime() - a.at.getTime();
      });

      return ok({
        accountId: data.account.id,
        accountName: data.account.name,
        currency: data.currency,
        openingBalance: money(opening),
        bookBalance: money(opening + totalR - totalP),
        clearedBalance: money(opening + clearedR - clearedP),
        unclearedReceipts: money(totalR - clearedR),
        unclearedPayments: money(totalP - clearedP),
        entries,
        lastReconciliation: data.lastRec
          ? {
              statementDate: data.lastRec.statementDate,
              statementBalance: Number(data.lastRec.statementBalance).toFixed(2),
              clearedBalance: Number(data.lastRec.clearedBalance).toFixed(2),
              difference: Number(data.lastRec.difference).toFixed(2),
              createdAt: data.lastRec.createdAt,
            }
          : null,
      });
    },

    async setCleared(ctx: TenantContext, rawInput: unknown): Promise<Result<null>> {
      const auth = authorize(ctx, 'accounts:write');
      if (!auth.ok) return auth;
      const parsed = setClearedSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const { kind, entryId, cleared } = parsed.data;
      const id =
        kind === 'receipt'
          ? await repo.setReceiptCleared(ctx, entryId, cleared)
          : await repo.setPaymentCleared(ctx, entryId, cleared);
      if (!id) return err(notFound('Entry'));
      return ok(null);
    },

    async recordReconciliation(
      ctx: TenantContext,
      accountId: string,
      rawInput: unknown,
    ): Promise<Result<{ difference: string }>> {
      const auth = authorize(ctx, 'accounts:write');
      if (!auth.ok) return auth;
      const parsed = recordReconciliationSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const clearedMinor = await computeClearedBalance(ctx, accountId);
      if (clearedMinor === null) return err(notFound('Account'));

      const clearedBalance = money(clearedMinor);
      const difference = money(Math.round(parsed.data.statementBalance * 100) - clearedMinor);
      await repo.insertReconciliation(ctx, accountId, parsed.data, clearedBalance, difference);
      return ok({ difference });
    },
  };
}

export type ReconciliationService = ReturnType<typeof createReconciliationService>;
