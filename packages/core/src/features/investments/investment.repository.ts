import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  investments,
  newId,
  organizations,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { InvestmentInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

// Correlated subquery uses a raw identifier (Drizzle table interpolation
// mis-correlates inside a subquery — see the grants/loans repositories).
const investmentFundName = sql<string | null>`(
  select f.name from funds f where f.id = investments.fund_id
)`;

export function createInvestmentRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const investmentColumns = {
    id: investments.id,
    institution: investments.institution,
    type: investments.type,
    fundId: investments.fundId,
    fundName: investmentFundName,
    reference: investments.reference,
    status: investments.status,
    investedOn: investments.investedOn,
    maturityDate: investments.maturityDate,
    interestRate: investments.interestRate,
    principal: investments.principal,
    maturityValue: investments.maturityValue,
  };

  const baseSelect = (tx: Tx) => tx.select(investmentColumns).from(investments);

  return {
    async list(ctx: TenantContext, scope: 'active' | 'all') {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where = and(
          eq(investments.organizationId, ctx.organizationId),
          scope === 'active' ? eq(investments.status, 'active') : undefined,
        );
        return baseSelect(tx)
          .where(where)
          .orderBy(asc(investments.status), asc(investments.maturityDate));
      });
    },

    async findById(ctx: TenantContext, investmentId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await baseSelect(tx).where(eq(investments.id, investmentId)).limit(1);
        return row ?? null;
      });
    },

    async create(ctx: TenantContext, input: InvestmentInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(investments)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            institution: input.institution,
            type: input.type,
            fundId: input.fundId ?? null,
            reference: input.reference ?? null,
            principal: input.principal.toFixed(2),
            interestRate: input.interestRate == null ? null : input.interestRate.toFixed(3),
            investedOn: input.investedOn,
            maturityDate: input.maturityDate ?? null,
            maturityValue: input.maturityValue == null ? null : input.maturityValue.toFixed(2),
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: investments.id });
        if (!row) throw new Error('investment insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'investment.created',
          entityType: 'investment',
          entityId: row.id,
          after: {
            institution: input.institution,
            type: input.type,
            principal: input.principal.toFixed(2),
          },
        });
        return row.id;
      });
    },

    async update(ctx: TenantContext, investmentId: string, input: InvestmentInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(investments)
          .set({
            institution: input.institution,
            type: input.type,
            fundId: input.fundId ?? null,
            reference: input.reference ?? null,
            principal: input.principal.toFixed(2),
            interestRate: input.interestRate == null ? null : input.interestRate.toFixed(3),
            investedOn: input.investedOn,
            maturityDate: input.maturityDate ?? null,
            maturityValue: input.maturityValue == null ? null : input.maturityValue.toFixed(2),
            note: input.note ?? null,
          })
          .where(eq(investments.id, investmentId))
          .returning({ id: investments.id });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'investment.updated',
          entityType: 'investment',
          entityId: investmentId,
          after: { institution: input.institution },
        });
        return updated.id;
      });
    },

    async setStatus(ctx: TenantContext, investmentId: string, status: 'active' | 'matured' | 'closed') {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(investments)
          .set({ status })
          .where(eq(investments.id, investmentId))
          .returning({ id: investments.id, institution: investments.institution });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: `investment.${status}`,
          entityType: 'investment',
          entityId: investmentId,
          after: { institution: updated.institution, status },
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
            activeCount: count(),
            totalInvested: sql<string>`coalesce(sum(${investments.principal}), 0)::numeric(14, 2)`,
            totalMaturityValue: sql<string>`coalesce(sum(
              coalesce(${investments.maturityValue}, ${investments.principal})
            ), 0)::numeric(14, 2)`,
          })
          .from(investments)
          .where(
            and(
              eq(investments.organizationId, ctx.organizationId),
              eq(investments.status, 'active'),
            ),
          );
        return {
          currency: org.currency,
          activeCount: row?.activeCount ?? 0,
          totalInvested: row?.totalInvested ?? '0.00',
          totalMaturityValue: row?.totalMaturityValue ?? '0.00',
        };
      });
    },

    async exportRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        baseSelect(tx)
          .where(eq(investments.organizationId, ctx.organizationId))
          .orderBy(asc(investments.status), asc(investments.maturityDate)),
      );
    },
  };
}

export type InvestmentRepository = ReturnType<typeof createInvestmentRepository>;
