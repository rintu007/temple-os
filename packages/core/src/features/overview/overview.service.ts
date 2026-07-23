import type { Db } from '@templeos/db';
import { authorize, ok, type Result, type TenantContext } from '../../shared';
import { createOverviewRepository } from './overview.repository';
import type { Overview } from './overview.types';

export function createOverviewService({ db }: { db: Db }) {
  const repo = createOverviewRepository(db);

  return {
    /** Command-center snapshot for the admin home. Read-only, every role may see it. */
    async getOverview(ctx: TenantContext): Promise<Result<Overview>> {
      const auth = authorize(ctx, 'overview:read');
      if (!auth.ok) return auth;
      const overview = await repo.getOverview(ctx);
      return ok(overview);
    },
  };
}

export type OverviewService = ReturnType<typeof createOverviewService>;
