import type { Db } from '@templeos/db';
import { devoteeListQuerySchema, devoteeSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createDevoteeRepository } from './devotee.repository';
import type { DevoteePage, DevoteeSummary } from './devotee.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

export function createDevoteeService({ db }: { db: Db }) {
  const repo = createDevoteeRepository(db);

  const toSummary = (d: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    gender: 'male' | 'female' | 'other' | null;
    dateOfBirth: string | null;
    addressLine1: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    notes: string | null;
    status: 'active' | 'archived';
    familyId: string | null;
    familyName?: string | null;
  }): DevoteeSummary => ({
    id: d.id,
    fullName: d.fullName,
    email: d.email,
    phone: d.phone,
    gender: d.gender,
    dateOfBirth: d.dateOfBirth,
    addressLine1: d.addressLine1,
    city: d.city,
    state: d.state,
    postalCode: d.postalCode,
    notes: d.notes,
    status: d.status,
    familyId: d.familyId,
    familyName: d.familyName ?? null,
  });

  return {
    async listDevotees(ctx: TenantContext, rawQuery: unknown): Promise<Result<DevoteePage>> {
      const auth = authorize(ctx, 'devotees:read');
      if (!auth.ok) return auth;

      const parsed = devoteeListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const query = { ...parsed.data, search: parsed.data.search ?? null };

      const { items, total } = await repo.list(ctx, query);
      return ok({
        items: items.map(toSummary),
        total,
        page: query.page,
        pageSize: query.pageSize,
      });
    },

    async getDevotee(ctx: TenantContext, devoteeId: string): Promise<Result<DevoteeSummary>> {
      const auth = authorize(ctx, 'devotees:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, devoteeId);
      if (!row) return err(notFound('Devotee'));
      return ok(toSummary(row));
    },

    async createDevotee(ctx: TenantContext, rawInput: unknown): Promise<Result<DevoteeSummary>> {
      const auth = authorize(ctx, 'devotees:write');
      if (!auth.ok) return auth;
      const parsed = devoteeSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const devotee = await repo.create(ctx, parsed.data);
      return ok(toSummary({ ...devotee, familyName: parsed.data.familyName ?? null }));
    },

    async updateDevotee(
      ctx: TenantContext,
      devoteeId: string,
      rawInput: unknown,
    ): Promise<Result<DevoteeSummary>> {
      const auth = authorize(ctx, 'devotees:write');
      if (!auth.ok) return auth;
      const parsed = devoteeSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const updated = await repo.update(ctx, devoteeId, parsed.data);
      if (!updated) return err(notFound('Devotee'));
      return ok(toSummary({ ...updated, familyName: parsed.data.familyName ?? null }));
    },

    async archiveDevotee(ctx: TenantContext, devoteeId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'devotees:write');
      if (!auth.ok) return auth;
      const row = await repo.setStatus(ctx, devoteeId, 'archived');
      if (!row) return err(notFound('Devotee'));
      return ok(null);
    },
  };
}

export type DevoteeService = ReturnType<typeof createDevoteeService>;
