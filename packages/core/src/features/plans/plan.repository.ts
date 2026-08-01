import { and, eq, ne } from 'drizzle-orm';
import { planCatalog, platformAdmins, platformSubscriptions, withTenantContext, type Db } from '@templeos/db';
import type {
  CreatePlanCatalogEntryInput,
  ModuleKey,
  PlanCatalogEntry,
  UpdatePlanCatalogEntryInput,
} from '@templeos/validators';

function toEntry(row: {
  key: string;
  name: string;
  priceUsd: number | null;
  description: string;
  features: string[];
  modules: string[];
  isPurchasable: boolean;
  seatLimit: number | null;
  stripePriceId: string | null;
  isTrialDefault: boolean;
  isFallbackDefault: boolean;
  sortOrder: number;
}): PlanCatalogEntry {
  return { ...row, modules: row.modules as ModuleKey[] };
}

export function createPlanRepository(db: Db) {
  return {
    /** Public data (RLS: plan_catalog_public_read) — every plan, in display order. */
    async list(): Promise<PlanCatalogEntry[]> {
      const rows = await db.select().from(planCatalog).orderBy(planCatalog.sortOrder);
      return rows.map(toEntry);
    },

    async getByKey(key: string): Promise<PlanCatalogEntry | null> {
      const [row] = await db.select().from(planCatalog).where(eq(planCatalog.key, key)).limit(1);
      return row ? toEntry(row) : null;
    },

    /** The plan new orgs are provisioned onto — see organization.repository.ts#provision. */
    async getTrialDefault(): Promise<PlanCatalogEntry | null> {
      const [row] = await db
        .select()
        .from(planCatalog)
        .where(eq(planCatalog.isTrialDefault, true))
        .limit(1);
      return row ? toEntry(row) : null;
    },

    /** What a lapsed/expired/no-subscription org's entitlement falls back to. */
    async getFallbackDefault(): Promise<PlanCatalogEntry | null> {
      const [row] = await db
        .select()
        .from(planCatalog)
        .where(eq(planCatalog.isFallbackDefault, true))
        .limit(1);
      return row ? toEntry(row) : null;
    },

    /** Kept local (not imported from the platform feature) so plans stays a self-contained, dependency-free feature. */
    async isPlatformAdmin(userId: string): Promise<boolean> {
      return withTenantContext(db, { userId }, async (tx) => {
        const [row] = await tx
          .select({ userId: platformAdmins.userId })
          .from(platformAdmins)
          .where(eq(platformAdmins.userId, userId))
          .limit(1);
        return row !== undefined;
      });
    },

    /** Null return means the key is already taken. */
    async create(actorUserId: string, input: CreatePlanCatalogEntryInput) {
      return withTenantContext(db, { userId: actorUserId }, async (tx) => {
        if (input.isTrialDefault) {
          await tx
            .update(planCatalog)
            .set({ isTrialDefault: false })
            .where(eq(planCatalog.isTrialDefault, true));
        }
        if (input.isFallbackDefault) {
          await tx
            .update(planCatalog)
            .set({ isFallbackDefault: false })
            .where(eq(planCatalog.isFallbackDefault, true));
        }
        const [row] = await tx
          .insert(planCatalog)
          .values(input)
          .onConflictDoNothing({ target: planCatalog.key })
          .returning();
        return row ? toEntry(row) : null;
      });
    },

    /** Null return means the key doesn't exist. */
    async update(actorUserId: string, key: string, input: UpdatePlanCatalogEntryInput) {
      return withTenantContext(db, { userId: actorUserId }, async (tx) => {
        if (input.isTrialDefault) {
          await tx
            .update(planCatalog)
            .set({ isTrialDefault: false })
            .where(and(eq(planCatalog.isTrialDefault, true), ne(planCatalog.key, key)));
        }
        if (input.isFallbackDefault) {
          await tx
            .update(planCatalog)
            .set({ isFallbackDefault: false })
            .where(and(eq(planCatalog.isFallbackDefault, true), ne(planCatalog.key, key)));
        }
        const [row] = await tx
          .update(planCatalog)
          .set(input)
          .where(eq(planCatalog.key, key))
          .returning();
        return row ? toEntry(row) : null;
      });
    },

    /** Returns 'not_found' | 'is_default' | 'in_use' | 'ok'. */
    async remove(actorUserId: string, key: string) {
      return withTenantContext(db, { userId: actorUserId }, async (tx) => {
        const [existing] = await tx
          .select({
            isTrialDefault: planCatalog.isTrialDefault,
            isFallbackDefault: planCatalog.isFallbackDefault,
          })
          .from(planCatalog)
          .where(eq(planCatalog.key, key))
          .limit(1);
        if (!existing) return { kind: 'not_found' as const };
        if (existing.isTrialDefault || existing.isFallbackDefault) {
          return { kind: 'is_default' as const };
        }

        const [inUse] = await tx
          .select({ organizationId: platformSubscriptions.organizationId })
          .from(platformSubscriptions)
          .where(eq(platformSubscriptions.plan, key))
          .limit(1);
        if (inUse) return { kind: 'in_use' as const };

        await tx.delete(planCatalog).where(eq(planCatalog.key, key));
        return { kind: 'ok' as const };
      });
    },
  };
}

export type PlanRepository = ReturnType<typeof createPlanRepository>;
