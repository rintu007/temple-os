import type { Db } from '@templeos/db';
import {
  createPlanCatalogEntrySchema,
  updatePlanCatalogEntrySchema,
  type PlanCatalogEntry,
} from '@templeos/validators';
import { conflict, domainError, err, forbidden, notFound, ok, type Result } from '../../shared';
import { createPlanRepository } from './plan.repository';

export function createPlanService({ db }: { db: Db }) {
  const repo = createPlanRepository(db);

  return {
    /** Public — the billing page (and a future pricing page) reads this with no auth. */
    async listPlans(): Promise<PlanCatalogEntry[]> {
      return repo.list();
    },

    async getPlan(key: string): Promise<PlanCatalogEntry | null> {
      return repo.getByKey(key);
    },

    async createPlan(actorUserId: string, rawInput: unknown): Promise<Result<PlanCatalogEntry>> {
      if (!(await repo.isPlatformAdmin(actorUserId))) {
        return err(forbidden('Platform admin access required'));
      }
      const parsed = createPlanCatalogEntrySchema.safeParse(rawInput);
      if (!parsed.success) {
        return err(domainError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid input'));
      }

      const row = await repo.create(actorUserId, parsed.data);
      if (!row) return err(conflict('A plan with this key already exists'));
      return ok(row);
    },

    async updatePlan(
      actorUserId: string,
      key: string,
      rawInput: unknown,
    ): Promise<Result<PlanCatalogEntry>> {
      if (!(await repo.isPlatformAdmin(actorUserId))) {
        return err(forbidden('Platform admin access required'));
      }
      const parsed = updatePlanCatalogEntrySchema.safeParse(rawInput);
      if (!parsed.success) {
        return err(domainError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid input'));
      }

      const row = await repo.update(actorUserId, key, parsed.data);
      if (!row) return err(notFound('Plan'));
      return ok(row);
    },

    async deletePlan(actorUserId: string, key: string): Promise<Result<null>> {
      if (!(await repo.isPlatformAdmin(actorUserId))) {
        return err(forbidden('Platform admin access required'));
      }
      const result = await repo.remove(actorUserId, key);
      if (result.kind === 'not_found') return err(notFound('Plan'));
      if (result.kind === 'is_default') {
        return err(
          conflict('Reassign the trial/fallback default to another plan before deleting this one'),
        );
      }
      if (result.kind === 'in_use') {
        return err(conflict('This plan is in use by at least one organization'));
      }
      return ok(null);
    },
  };
}

export type PlanService = ReturnType<typeof createPlanService>;
