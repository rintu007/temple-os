import { and, count, desc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  fundTransfers,
  funds,
  newId,
  organizations,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { FundTransferInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

// Correlated subqueries use raw identifiers (Drizzle table interpolation
// mis-correlates inside a subquery — see the transfers/funds repositories).
const fromName = sql<string>`(
  select f.name from funds f where f.id = fund_transfers.from_fund_id
)`;
const toName = sql<string>`(
  select f.name from funds f where f.id = fund_transfers.to_fund_id
)`;

export function createFundTransferRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const columns = {
    id: fundTransfers.id,
    fromFundId: fundTransfers.fromFundId,
    fromFundName: fromName,
    toFundId: fundTransfers.toFundId,
    toFundName: toName,
    amount: fundTransfers.amount,
    transferredOn: fundTransfers.transferredOn,
    reference: fundTransfers.reference,
    note: fundTransfers.note,
  };

  const baseSelect = (tx: Tx) => tx.select(columns).from(fundTransfers);

  return {
    async list(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(fundTransfers.organizationId, ctx.organizationId))
          .orderBy(desc(fundTransfers.transferredOn), desc(fundTransfers.createdAt))
          .limit(500),
      );
    },

    /** True when the fund exists in this tenant and is currently active. */
    async isActiveFund(ctx: TenantContext, fundId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select({ id: funds.id })
          .from(funds)
          .where(and(eq(funds.id, fundId), eq(funds.isActive, true)))
          .limit(1);
        return Boolean(row);
      });
    },

    async create(ctx: TenantContext, input: FundTransferInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(fundTransfers)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            fromFundId: input.fromFundId,
            toFundId: input.toFundId,
            amount: input.amount.toFixed(2),
            transferredOn: input.transferredOn,
            reference: input.reference ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: fundTransfers.id });
        if (!row) throw new Error('fund transfer insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'fund.transferred',
          entityType: 'fund_transfer',
          entityId: row.id,
          after: {
            fromFundId: input.fromFundId,
            toFundId: input.toFundId,
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
            total: sql<string>`coalesce(sum(${fundTransfers.amount}), 0)::numeric(14, 2)`,
          })
          .from(fundTransfers)
          .where(eq(fundTransfers.organizationId, ctx.organizationId));
        return { currency: org.currency, count: row?.count ?? 0, total: row?.total ?? '0.00' };
      });
    },

    async exportRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(fundTransfers.organizationId, ctx.organizationId))
          .orderBy(desc(fundTransfers.transferredOn)),
      );
    },
  };
}

export type FundTransferRepository = ReturnType<typeof createFundTransferRepository>;
