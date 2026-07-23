import { eq } from 'drizzle-orm';
import { organizations, withTenantContext, type Db } from '@templeos/db';
import { campaignSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createCampaignRepository } from './campaign.repository';
import type { CampaignSummary, PublicCampaign } from './campaign.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

function toSummary(row: {
  id: string;
  title: string;
  description: string | null;
  goalAmount: string;
  raisedAmount: string;
  donationCount: number;
  currency: 'INR' | 'BDT';
  status: 'active' | 'completed' | 'archived';
  createdAt: Date;
}): CampaignSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    goalAmount: row.goalAmount,
    raisedAmount: row.raisedAmount,
    donationCount: row.donationCount,
    currency: row.currency,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function percentOf(raised: string, goal: string): number {
  const g = Number(goal);
  if (!(g > 0)) return 0;
  return Math.min(100, Math.round((Number(raised) / g) * 100));
}

export function createCampaignService({ db }: { db: Db }) {
  const repo = createCampaignRepository(db);

  return {
    async listCampaigns(ctx: TenantContext): Promise<Result<CampaignSummary[]>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx);
      return ok(rows.map(toSummary));
    },

    async getCampaign(ctx: TenantContext, campaignId: string): Promise<Result<CampaignSummary>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, campaignId);
      if (!row) return err(notFound('Campaign'));
      return ok(toSummary(row));
    },

    /** Active campaigns for the donation-form dropdown. */
    async listActiveOptions(
      ctx: TenantContext,
    ): Promise<Result<Array<{ id: string; title: string }>>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      return ok(await repo.listActiveOptions(ctx));
    },

    async createCampaign(ctx: TenantContext, rawInput: unknown): Promise<Result<CampaignSummary>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;
      const parsed = campaignSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const currency = await withTenantContext(db, { organizationId: ctx.organizationId }, async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        return org?.currency ?? 'INR';
      });

      const row = await repo.create(ctx, parsed.data, currency);
      return ok(toSummary({ ...row, raisedAmount: '0.00', donationCount: 0 }));
    },

    async setCampaignStatus(
      ctx: TenantContext,
      campaignId: string,
      status: 'active' | 'completed' | 'archived',
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;
      const updated = await repo.setStatus(ctx, campaignId, status);
      if (!updated) return err(notFound('Campaign'));
      return ok(null);
    },

    /** Public site — active campaigns with progress. */
    async listPublicCampaigns(organizationId: string): Promise<PublicCampaign[]> {
      const rows = await repo.listPublic(organizationId);
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        goalAmount: r.goalAmount,
        raisedAmount: r.raisedAmount,
        currency: r.currency,
        percent: percentOf(r.raisedAmount, r.goalAmount),
      }));
    },
  };
}

export type CampaignService = ReturnType<typeof createCampaignService>;
