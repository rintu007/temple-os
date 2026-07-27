import { and, count, desc, eq, sql } from 'drizzle-orm';
import {
  accountTransfers,
  auditLogs,
  financialAccounts,
  newId,
  organizations,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { TransferInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

// Correlated subqueries use raw identifiers (Drizzle table interpolation
// mis-correlates inside a subquery — see the grants/accounts repositories).
const fromName = sql<string>`(
  select a.name from financial_accounts a where a.id = account_transfers.from_account_id
)`;
const toName = sql<string>`(
  select a.name from financial_accounts a where a.id = account_transfers.to_account_id
)`;

export function createTransferRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const columns = {
    id: accountTransfers.id,
    fromAccountId: accountTransfers.fromAccountId,
    fromAccountName: fromName,
    toAccountId: accountTransfers.toAccountId,
    toAccountName: toName,
    amount: accountTransfers.amount,
    transferredOn: accountTransfers.transferredOn,
    reference: accountTransfers.reference,
    note: accountTransfers.note,
  };

  const baseSelect = (tx: Tx) => tx.select(columns).from(accountTransfers);

  return {
    async list(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(accountTransfers.organizationId, ctx.organizationId))
          .orderBy(desc(accountTransfers.transferredOn), desc(accountTransfers.createdAt))
          .limit(500),
      );
    },

    /** True when the account exists in this tenant and is currently active. */
    async isActiveAccount(ctx: TenantContext, accountId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select({ id: financialAccounts.id })
          .from(financialAccounts)
          .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.isActive, true)))
          .limit(1);
        return Boolean(row);
      });
    },

    async create(ctx: TenantContext, input: TransferInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(accountTransfers)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            fromAccountId: input.fromAccountId,
            toAccountId: input.toAccountId,
            amount: input.amount.toFixed(2),
            transferredOn: input.transferredOn,
            reference: input.reference ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: accountTransfers.id });
        if (!row) throw new Error('transfer insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'account.transferred',
          entityType: 'account_transfer',
          entityId: row.id,
          after: {
            fromAccountId: input.fromAccountId,
            toAccountId: input.toAccountId,
            amount: input.amount.toFixed(2),
          },
        });
        return row.id;
      });
    },

    async stats(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const [row] = await tx
          .select({
            count: count(),
            total: sql<string>`coalesce(sum(${accountTransfers.amount}), 0)::numeric(14, 2)`,
          })
          .from(accountTransfers)
          .where(eq(accountTransfers.organizationId, ctx.organizationId));
        return { currency: org.currency, count: row?.count ?? 0, total: row?.total ?? '0.00' };
      });
    },

    async exportRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(accountTransfers.organizationId, ctx.organizationId))
          .orderBy(desc(accountTransfers.transferredOn)),
      );
    },
  };
}

export type TransferRepository = ReturnType<typeof createTransferRepository>;
