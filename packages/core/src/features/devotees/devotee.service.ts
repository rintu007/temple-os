import type { Db } from '@templeos/db';
import { devoteeListQuerySchema, devoteeSchema, type DevoteeInput } from '@templeos/validators';
import { mapCsvToDevoteeInputs } from './devotee-csv';
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
import type { DevoteePage, DevoteeSummary, ImportResult, ImportRowError } from './devotee.types';

const MAX_IMPORT_ROWS = 500;

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

    /** CSV import: flexible headers, per-row validation, org-wide dedupe by phone/email. */
    async importDevoteesFromCsv(ctx: TenantContext, csvText: string): Promise<Result<ImportResult>> {
      const auth = authorize(ctx, 'devotees:write');
      if (!auth.ok) return auth;

      const { candidates, headerError } = mapCsvToDevoteeInputs(csvText);
      if (headerError) return err(domainError('VALIDATION', headerError));
      if (candidates.length > MAX_IMPORT_ROWS) {
        return err(
          domainError('VALIDATION', `Too many rows — import at most ${MAX_IMPORT_ROWS} at a time`),
        );
      }

      const valid: DevoteeInput[] = [];
      const errors: ImportRowError[] = [];
      for (const candidate of candidates) {
        const parsed = devoteeSchema.safeParse(candidate.input);
        if (parsed.success) {
          valid.push(parsed.data);
        } else {
          errors.push({
            line: candidate.line,
            message: parsed.error.issues[0]?.message ?? 'Invalid row',
          });
        }
      }

      if (valid.length === 0) {
        return ok({ imported: 0, duplicates: 0, errors });
      }
      const { imported, duplicates } = await repo.importMany(ctx, valid);
      return ok({ imported, duplicates, errors });
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
