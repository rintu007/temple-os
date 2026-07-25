import type { Db } from '@templeos/db';
import { authorize, ok, type Result, type TenantContext } from '../../shared';
import { csvField } from '../reports/report.service';
import { createAuditRepository } from './audit.repository';
import type { ActivityFilters, ActivityPage } from './audit.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseFilters(raw: unknown): ActivityFilters {
  const q = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  const date = (v: unknown) => {
    const s = str(v);
    return s && DATE_RE.test(s) ? s : null;
  };
  return { entityType: str(q.entityType), from: date(q.from), to: date(q.to) };
}

/** 'donation.recorded' → 'Donation recorded'. */
function humanizeAction(action: string): string {
  const words = action.replace(/[._]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function createAuditService({ db }: { db: Db }) {
  const repo = createAuditRepository(db);

  return {
    async listActivity(ctx: TenantContext, rawQuery: unknown): Promise<Result<ActivityPage>> {
      const auth = authorize(ctx, 'governance:read');
      if (!auth.ok) return auth;

      const q = (rawQuery ?? {}) as { page?: unknown; pageSize?: unknown };
      const page = Math.max(1, Number(q.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 30));
      const { items, total } = await repo.list(ctx, parseFilters(rawQuery), page, pageSize);
      return ok({ items, total, page, pageSize });
    },

    async listEntityTypes(ctx: TenantContext): Promise<Result<string[]>> {
      const auth = authorize(ctx, 'governance:read');
      if (!auth.ok) return auth;
      return ok(await repo.entityTypes(ctx));
    },

    async exportCsv(ctx: TenantContext, rawQuery: unknown): Promise<Result<string>> {
      const auth = authorize(ctx, 'governance:read');
      if (!auth.ok) return auth;

      const rows = await repo.exportRows(ctx, parseFilters(rawQuery));
      const header = ['Timestamp', 'Actor', 'Action', 'Entity', 'Entity ID'].join(',');
      const lines = rows.map((r) =>
        [
          csvField(r.createdAt.toISOString()),
          csvField(r.actorName ?? 'System'),
          csvField(humanizeAction(r.action)),
          csvField(r.entityType),
          csvField(r.entityId),
        ].join(','),
      );
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
