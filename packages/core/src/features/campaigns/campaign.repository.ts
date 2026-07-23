import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import {
  auditLogs,
  campaigns,
  donations,
  newId,
  withTenantContext,
  type Db,
  type Tx,
} from '@templeos/db';
import type { CampaignInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

interface Raised {
  raisedAmount: string;
  donationCount: number;
}

const ZERO: Raised = { raisedAmount: '0.00', donationCount: 0 };

/**
 * Recorded-donation totals grouped by campaign for one org, as a Map. Derived
 * live so a campaign's progress never drifts from its ledger.
 */
async function raisedByCampaign(tx: Tx, organizationId: string): Promise<Map<string, Raised>> {
  const rows = await tx
    .select({
      campaignId: donations.campaignId,
      total: sql<string>`coalesce(sum(${donations.amount}), '0.00')`,
      count: count(),
    })
    .from(donations)
    .where(
      and(
        eq(donations.organizationId, organizationId),
        eq(donations.status, 'recorded'),
        isNotNull(donations.campaignId),
      ),
    )
    .groupBy(donations.campaignId);

  const map = new Map<string, Raised>();
  for (const r of rows) {
    if (r.campaignId) map.set(r.campaignId, { raisedAmount: r.total, donationCount: r.count });
  }
  return map;
}

export function createCampaignRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async list(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [rows, raised] = await Promise.all([
          tx
            .select()
            .from(campaigns)
            .where(eq(campaigns.organizationId, ctx.organizationId))
            .orderBy(desc(campaigns.createdAt)),
          raisedByCampaign(tx, ctx.organizationId),
        ]);
        return rows.map((c) => ({ ...c, ...(raised.get(c.id) ?? ZERO) }));
      });
    },

    async findById(ctx: TenantContext, campaignId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select()
          .from(campaigns)
          .where(eq(campaigns.id, campaignId))
          .limit(1);
        if (!row) return null;
        const raised = await raisedByCampaign(tx, ctx.organizationId);
        return { ...row, ...(raised.get(row.id) ?? ZERO) };
      });
    },

    /** Active campaigns for the org's public site, with live raised totals. */
    async listPublic(organizationId: string) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [rows, raised] = await Promise.all([
          tx
            .select()
            .from(campaigns)
            .where(
              and(eq(campaigns.organizationId, organizationId), eq(campaigns.status, 'active')),
            )
            .orderBy(desc(campaigns.createdAt)),
          raisedByCampaign(tx, organizationId),
        ]);
        return rows.map((c) => ({ ...c, ...(raised.get(c.id) ?? ZERO) }));
      });
    },

    /** Simple options list (active only) for the donation form selector. */
    async listActiveOptions(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select({ id: campaigns.id, title: campaigns.title })
          .from(campaigns)
          .where(
            and(
              eq(campaigns.organizationId, ctx.organizationId),
              eq(campaigns.status, 'active'),
            ),
          )
          .orderBy(desc(campaigns.createdAt)),
      );
    },

    async create(ctx: TenantContext, input: CampaignInput, currency: 'INR' | 'BDT') {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(campaigns)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            title: input.title,
            description: input.description ?? null,
            goalAmount: input.goalAmount.toFixed(2),
            currency,
          })
          .returning();
        if (!row) throw new Error('campaign insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'campaign.created',
          entityType: 'campaign',
          entityId: row.id,
          after: { title: row.title, goalAmount: row.goalAmount },
        });
        return row;
      });
    },

    async setStatus(
      ctx: TenantContext,
      campaignId: string,
      status: 'active' | 'completed' | 'archived',
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(campaigns)
          .set({ status })
          .where(eq(campaigns.id, campaignId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'campaign.status_changed',
          entityType: 'campaign',
          entityId: campaignId,
          after: { status },
        });
        return updated;
      });
    },
  };
}

export type CampaignRepository = ReturnType<typeof createCampaignRepository>;
