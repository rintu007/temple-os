import { and, desc, eq, isNotNull, sql, type AnyColumn } from 'drizzle-orm';
import {
  accountReconciliations,
  accountTransfers,
  auditLogs,
  donations,
  expenses,
  financialAccounts,
  newId,
  organizations,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { RecordReconciliationInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

const sumAmount = (col: AnyColumn) => sql<string>`coalesce(sum(${col}), 0)::numeric(12, 2)`;

// Counterparty account name on each side of a transfer.
const transferFromName = sql<string>`(
  select a.name from financial_accounts a where a.id = account_transfers.from_account_id
)`;
const transferToName = sql<string>`(
  select a.name from financial_accounts a where a.id = account_transfers.to_account_id
)`;

export function createReconciliationRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    /** Everything the reconcile view needs: account header, sums and entries. */
    async reconcileData(ctx: TenantContext, accountId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const [account] = await tx
          .select({
            id: financialAccounts.id,
            name: financialAccounts.name,
            openingBalance: financialAccounts.openingBalance,
          })
          .from(financialAccounts)
          .where(eq(financialAccounts.id, accountId))
          .limit(1);
        if (!account) return null;

        const donationRecorded = and(
          eq(donations.accountId, accountId),
          eq(donations.status, 'recorded'),
        );
        const expenseRecorded = and(
          eq(expenses.accountId, accountId),
          eq(expenses.status, 'recorded'),
        );
        // Transfers into this account (destination side) and out of it (source side).
        const transferInWhere = eq(accountTransfers.toAccountId, accountId);
        const transferOutWhere = eq(accountTransfers.fromAccountId, accountId);

        const [
          [receiptSums],
          [paymentSums],
          receipts,
          payments,
          [transferInSums],
          [transferOutSums],
          transfersIn,
          transfersOut,
          [lastRec],
        ] = await Promise.all([
          tx
            .select({
              total: sumAmount(donations.amount),
              cleared: sql<string>`coalesce(sum(${donations.amount}) filter (where ${donations.clearedAt} is not null), 0)::numeric(12, 2)`,
            })
            .from(donations)
            .where(donationRecorded),
          tx
            .select({
              total: sumAmount(expenses.amount),
              cleared: sql<string>`coalesce(sum(${expenses.amount}) filter (where ${expenses.clearedAt} is not null), 0)::numeric(12, 2)`,
            })
            .from(expenses)
            .where(expenseRecorded),
          tx
            .select({
              id: donations.id,
              ref: donations.receiptNumber,
              party: donations.donorName,
              amount: donations.amount,
              at: donations.donatedAt,
              clearedAt: donations.clearedAt,
            })
            .from(donations)
            .where(donationRecorded)
            .orderBy(desc(donations.donatedAt))
            .limit(300),
          tx
            .select({
              id: expenses.id,
              ref: expenses.voucherNumber,
              party: expenses.paidTo,
              amount: expenses.amount,
              at: expenses.spentAt,
              clearedAt: expenses.clearedAt,
            })
            .from(expenses)
            .where(expenseRecorded)
            .orderBy(desc(expenses.spentAt))
            .limit(300),
          tx
            .select({
              total: sumAmount(accountTransfers.amount),
              cleared: sql<string>`coalesce(sum(${accountTransfers.amount}) filter (where ${accountTransfers.toClearedAt} is not null), 0)::numeric(12, 2)`,
            })
            .from(accountTransfers)
            .where(transferInWhere),
          tx
            .select({
              total: sumAmount(accountTransfers.amount),
              cleared: sql<string>`coalesce(sum(${accountTransfers.amount}) filter (where ${accountTransfers.fromClearedAt} is not null), 0)::numeric(12, 2)`,
            })
            .from(accountTransfers)
            .where(transferOutWhere),
          tx
            .select({
              id: accountTransfers.id,
              party: transferFromName,
              amount: accountTransfers.amount,
              at: accountTransfers.transferredOn,
              clearedAt: accountTransfers.toClearedAt,
            })
            .from(accountTransfers)
            .where(transferInWhere)
            .orderBy(desc(accountTransfers.transferredOn))
            .limit(300),
          tx
            .select({
              id: accountTransfers.id,
              party: transferToName,
              amount: accountTransfers.amount,
              at: accountTransfers.transferredOn,
              clearedAt: accountTransfers.fromClearedAt,
            })
            .from(accountTransfers)
            .where(transferOutWhere)
            .orderBy(desc(accountTransfers.transferredOn))
            .limit(300),
          tx
            .select({
              statementDate: accountReconciliations.statementDate,
              statementBalance: accountReconciliations.statementBalance,
              clearedBalance: accountReconciliations.clearedBalance,
              difference: accountReconciliations.difference,
              createdAt: accountReconciliations.createdAt,
            })
            .from(accountReconciliations)
            .where(eq(accountReconciliations.accountId, accountId))
            .orderBy(desc(accountReconciliations.statementDate), desc(accountReconciliations.createdAt))
            .limit(1),
        ]);

        return {
          currency: org.currency,
          account,
          receiptSums: receiptSums ?? { total: '0.00', cleared: '0.00' },
          paymentSums: paymentSums ?? { total: '0.00', cleared: '0.00' },
          transferInSums: transferInSums ?? { total: '0.00', cleared: '0.00' },
          transferOutSums: transferOutSums ?? { total: '0.00', cleared: '0.00' },
          receipts,
          payments,
          transfersIn,
          transfersOut,
          lastRec: lastRec ?? null,
        };
      });
    },

    /** Toggle a receipt's cleared flag. Returns the row id, or null if not found. */
    async setReceiptCleared(ctx: TenantContext, entryId: string, cleared: boolean) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .update(donations)
          .set({ clearedAt: cleared ? new Date() : null })
          .where(and(eq(donations.id, entryId), isNotNull(donations.accountId)))
          .returning({ id: donations.id });
        return row?.id ?? null;
      });
    },

    async setPaymentCleared(ctx: TenantContext, entryId: string, cleared: boolean) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .update(expenses)
          .set({ clearedAt: cleared ? new Date() : null })
          .where(and(eq(expenses.id, entryId), isNotNull(expenses.accountId)))
          .returning({ id: expenses.id });
        return row?.id ?? null;
      });
    },

    /** Clear the destination side of a transfer (it credits this account). */
    async setTransferInCleared(ctx: TenantContext, entryId: string, cleared: boolean) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .update(accountTransfers)
          .set({ toClearedAt: cleared ? new Date() : null })
          .where(eq(accountTransfers.id, entryId))
          .returning({ id: accountTransfers.id });
        return row?.id ?? null;
      });
    },

    /** Clear the source side of a transfer (it debits this account). */
    async setTransferOutCleared(ctx: TenantContext, entryId: string, cleared: boolean) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .update(accountTransfers)
          .set({ fromClearedAt: cleared ? new Date() : null })
          .where(eq(accountTransfers.id, entryId))
          .returning({ id: accountTransfers.id });
        return row?.id ?? null;
      });
    },

    async insertReconciliation(
      ctx: TenantContext,
      accountId: string,
      input: RecordReconciliationInput,
      clearedBalance: string,
      difference: string,
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(accountReconciliations)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            accountId,
            statementDate: input.statementDate,
            statementBalance: input.statementBalance.toFixed(2),
            clearedBalance,
            difference,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: accountReconciliations.id });
        if (!row) throw new Error('reconciliation insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'account.reconciled',
          entityType: 'account_reconciliation',
          entityId: row.id,
          after: {
            accountId,
            statementDate: input.statementDate,
            statementBalance: input.statementBalance.toFixed(2),
            difference,
          },
        });
        return row.id;
      });
    },
  };
}

export type ReconciliationRepository = ReturnType<typeof createReconciliationRepository>;
