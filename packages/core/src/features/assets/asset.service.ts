import { eq } from 'drizzle-orm';
import { organizations, withTenantContext, type Db } from '@templeos/db';
import { assetSchema, disposeAssetSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createAssetRepository } from './asset.repository';
import type { AssetStats, AssetStatus, AssetSummary } from './asset.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

function toSummary(row: {
  id: string;
  name: string;
  category: AssetSummary['category'];
  description: string | null;
  quantity: number;
  estimatedValue: string | null;
  currency: 'INR' | 'BDT';
  acquiredOn: string | null;
  location: string | null;
  status: AssetStatus;
  disposalReason: string | null;
  note: string | null;
  createdAt: Date;
}): AssetSummary {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    quantity: row.quantity,
    estimatedValue: row.estimatedValue,
    currency: row.currency,
    acquiredOn: row.acquiredOn,
    location: row.location,
    status: row.status,
    disposalReason: row.disposalReason,
    note: row.note,
    createdAt: row.createdAt,
  };
}

async function orgCurrency(db: Db, organizationId: string): Promise<'INR' | 'BDT'> {
  return withTenantContext(db, { organizationId }, async (tx) => {
    const [org] = await tx
      .select({ currency: organizations.currency })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!org) throw new Error('organization not visible in tenant context');
    return org.currency;
  });
}

export function createAssetService({ db }: { db: Db }) {
  const repo = createAssetRepository(db);

  return {
    async listAssets(
      ctx: TenantContext,
      status: AssetStatus | 'all' = 'active',
    ): Promise<Result<AssetSummary[]>> {
      const auth = authorize(ctx, 'assets:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx, status);
      return ok(rows.map(toSummary));
    },

    async getAsset(ctx: TenantContext, assetId: string): Promise<Result<AssetSummary>> {
      const auth = authorize(ctx, 'assets:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, assetId);
      if (!row) return err(notFound('Asset'));
      return ok(toSummary(row));
    },

    async getStats(ctx: TenantContext): Promise<Result<AssetStats>> {
      const auth = authorize(ctx, 'assets:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx));
    },

    async createAsset(ctx: TenantContext, rawInput: unknown): Promise<Result<AssetSummary>> {
      const auth = authorize(ctx, 'assets:write');
      if (!auth.ok) return auth;
      const parsed = assetSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const currency = await orgCurrency(db, ctx.organizationId);
      const row = await repo.create(ctx, parsed.data, currency);
      return ok(toSummary(row));
    },

    async updateAsset(
      ctx: TenantContext,
      assetId: string,
      rawInput: unknown,
    ): Promise<Result<AssetSummary>> {
      const auth = authorize(ctx, 'assets:write');
      if (!auth.ok) return auth;
      const parsed = assetSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const updated = await repo.update(ctx, assetId, parsed.data);
      if (!updated) return err(notFound('Asset'));
      return ok(toSummary(updated));
    },

    async disposeAsset(
      ctx: TenantContext,
      assetId: string,
      rawInput: unknown,
    ): Promise<Result<AssetSummary>> {
      const auth = authorize(ctx, 'assets:write');
      if (!auth.ok) return auth;
      const parsed = disposeAssetSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const updated = await repo.dispose(ctx, assetId, parsed.data.reason);
      if (!updated) return err(notFound('Asset'));
      return ok(toSummary(updated));
    },
  };
}

export type AssetService = ReturnType<typeof createAssetService>;
