import { and, asc, count, desc, eq, or, sql } from 'drizzle-orm';
import {
  accountTransfers,
  auditLogs,
  donations,
  expenses,
  financialAccounts,
  newId,
  organizations,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { AccountInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

// Correlated subqueries use raw identifiers (Drizzle table interpolation
// mis-correlates inside a subquery — see the funds/vendors repositories).

const accountReceived = sql<string>`coalesce((
  select sum(d.amount) from donations d
  where d.account_id = financial_accounts.id and d.status = 'recorded'
), 0)::numeric(12, 2)`;

const accountPaid = sql<string>`coalesce((
  select sum(e.amount) from expenses e
  where e.account_id = financial_accounts.id and e.status = 'recorded'
), 0)::numeric(12, 2)`;

const accountTransfersIn = sql<string>`coalesce((
  select sum(t.amount) from account_transfers t
  where t.to_account_id = financial_accounts.id
), 0)::numeric(12, 2)`;

const accountTransfersOut = sql<string>`coalesce((
  select sum(t.amount) from account_transfers t
  where t.from_account_id = financial_accounts.id
), 0)::numeric(12, 2)`;

// The counterparty account name on each side of a transfer.
const fromName = sql<string>`(
  select a.name from financial_accounts a where a.id = account_transfers.from_account_id
)`.as('from_name');
const toName = sql<string>`(
  select a.name from financial_accounts a where a.id = account_transfers.to_account_id
)`.as('to_name');

export function createAccountRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const accountColumns = {
    id: financialAccounts.id,
    name: financialAccounts.name,
    type: financialAccounts.type,
    bankName: financialAccounts.bankName,
    accountNumber: financialAccounts.accountNumber,
    openingBalance: financialAccounts.openingBalance,
    isActive: financialAccounts.isActive,
    received: accountReceived,
    paid: accountPaid,
    transfersIn: accountTransfersIn,
    transfersOut: accountTransfersOut,
  };

  const baseSelect = (tx: Tx) => tx.select(accountColumns).from(financialAccounts);

  return {
    async list(ctx: TenantContext, scope: 'active' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where = and(
          eq(financialAccounts.organizationId, ctx.organizationId),
          scope === 'active' ? eq(financialAccounts.isActive, true) : undefined,
        );
        return baseSelect(tx)
          .where(where)
          .orderBy(desc(financialAccounts.isActive), asc(financialAccounts.name));
      });
    },

    async findById(ctx: TenantContext, accountId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx).where(eq(financialAccounts.id, accountId)).limit(1);
        return row ?? null;
      });
    },

    /** Recorded receipts and payments tagged to an account, plus org currency. */
    async movements(ctx: TenantContext, accountId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const [receipts, payments, transfers] = await Promise.all([
          tx
            .select({
              id: donations.id,
              ref: donations.receiptNumber,
              party: donations.donorName,
              amount: donations.amount,
              at: donations.donatedAt,
            })
            .from(donations)
            .where(and(eq(donations.accountId, accountId), eq(donations.status, 'recorded')))
            .orderBy(desc(donations.donatedAt))
            .limit(200),
          tx
            .select({
              id: expenses.id,
              ref: expenses.voucherNumber,
              party: expenses.paidTo,
              amount: expenses.amount,
              at: expenses.spentAt,
            })
            .from(expenses)
            .where(and(eq(expenses.accountId, accountId), eq(expenses.status, 'recorded')))
            .orderBy(desc(expenses.spentAt))
            .limit(200),
          tx
            .select({
              id: accountTransfers.id,
              fromAccountId: accountTransfers.fromAccountId,
              toAccountId: accountTransfers.toAccountId,
              fromName,
              toName,
              amount: accountTransfers.amount,
              at: accountTransfers.transferredOn,
            })
            .from(accountTransfers)
            .where(
              or(
                eq(accountTransfers.fromAccountId, accountId),
                eq(accountTransfers.toAccountId, accountId),
              ),
            )
            .orderBy(desc(accountTransfers.transferredOn))
            .limit(200),
        ]);
        return { currency: org.currency, receipts, payments, transfers };
      });
    },

    async create(ctx: TenantContext, input: AccountInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(financialAccounts)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            name: input.name,
            type: input.type,
            bankName: input.bankName ?? null,
            accountNumber: input.accountNumber ?? null,
            openingBalance: input.openingBalance.toFixed(2),
            openingDate: input.openingDate ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: financialAccounts.id });
        if (!row) throw new Error('account insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'account.created',
          entityType: 'financial_account',
          entityId: row.id,
          after: { name: input.name, type: input.type },
        });
        return row.id;
      });
    },

    async update(ctx: TenantContext, accountId: string, input: AccountInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(financialAccounts)
          .set({
            name: input.name,
            type: input.type,
            bankName: input.bankName ?? null,
            accountNumber: input.accountNumber ?? null,
            openingBalance: input.openingBalance.toFixed(2),
            openingDate: input.openingDate ?? null,
            note: input.note ?? null,
          })
          .where(eq(financialAccounts.id, accountId))
          .returning({ id: financialAccounts.id });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'account.updated',
          entityType: 'financial_account',
          entityId: accountId,
          after: { name: input.name },
        });
        return updated.id;
      });
    },

    async setActive(ctx: TenantContext, accountId: string, isActive: boolean) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(financialAccounts)
          .set({ isActive })
          .where(eq(financialAccounts.id, accountId))
          .returning({ id: financialAccounts.id, name: financialAccounts.name });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: isActive ? 'account.reactivated' : 'account.archived',
          entityType: 'financial_account',
          entityId: accountId,
          after: { name: updated.name, isActive },
        });
        return updated.id;
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
            balance: sql<string>`coalesce(sum(
              ${financialAccounts.openingBalance} + ${accountReceived} - ${accountPaid}
              + ${accountTransfersIn} - ${accountTransfersOut}
            ), 0)::numeric(12, 2)`,
            activeCount: count(),
          })
          .from(financialAccounts)
          .where(
            and(
              eq(financialAccounts.organizationId, ctx.organizationId),
              eq(financialAccounts.isActive, true),
            ),
          );
        return {
          currency: org.currency,
          totalBalance: row?.balance ?? '0.00',
          activeCount: row?.activeCount ?? 0,
        };
      });
    },

    async exportRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(financialAccounts.organizationId, ctx.organizationId))
          .orderBy(asc(financialAccounts.name)),
      );
    },
  };
}

export type AccountRepository = ReturnType<typeof createAccountRepository>;
