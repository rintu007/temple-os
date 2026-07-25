import type { Db } from '@templeos/db';
import { officeBearerSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { csvField } from '../reports/report.service';
import { createOfficerRepository } from './officer.repository';
import type { OfficeBearerSummary } from './officer.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

function toSummary(row: {
  id: string;
  name: string;
  designation: string;
  body: string | null;
  phone: string | null;
  email: string | null;
  termStartsOn: string | null;
  termEndsOn: string | null;
  isActive: boolean;
  note: string | null;
  createdAt: Date;
}): OfficeBearerSummary {
  return {
    id: row.id,
    name: row.name,
    designation: row.designation,
    body: row.body,
    phone: row.phone,
    email: row.email,
    termStartsOn: row.termStartsOn,
    termEndsOn: row.termEndsOn,
    isActive: row.isActive,
    note: row.note,
    createdAt: row.createdAt,
  };
}

export function createOfficerService({ db }: { db: Db }) {
  const repo = createOfficerRepository(db);

  return {
    async listOfficers(
      ctx: TenantContext,
      scope: 'active' | 'all' = 'all',
    ): Promise<Result<OfficeBearerSummary[]>> {
      const auth = authorize(ctx, 'governance:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx, scope);
      return ok(rows.map(toSummary));
    },

    async getOfficer(ctx: TenantContext, officerId: string): Promise<Result<OfficeBearerSummary>> {
      const auth = authorize(ctx, 'governance:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, officerId);
      if (!row) return err(notFound('Office bearer'));
      return ok(toSummary(row));
    },

    async createOfficer(
      ctx: TenantContext,
      rawInput: unknown,
    ): Promise<Result<OfficeBearerSummary>> {
      const auth = authorize(ctx, 'governance:write');
      if (!auth.ok) return auth;
      const parsed = officeBearerSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const row = await repo.create(ctx, parsed.data);
      return ok(toSummary(row));
    },

    async updateOfficer(
      ctx: TenantContext,
      officerId: string,
      rawInput: unknown,
    ): Promise<Result<OfficeBearerSummary>> {
      const auth = authorize(ctx, 'governance:write');
      if (!auth.ok) return auth;
      const parsed = officeBearerSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const updated = await repo.update(ctx, officerId, parsed.data);
      if (!updated) return err(notFound('Office bearer'));
      return ok(toSummary(updated));
    },

    async setOfficerActive(
      ctx: TenantContext,
      officerId: string,
      isActive: boolean,
    ): Promise<Result<OfficeBearerSummary>> {
      const auth = authorize(ctx, 'governance:write');
      if (!auth.ok) return auth;
      const updated = await repo.setActive(ctx, officerId, isActive);
      if (!updated) return err(notFound('Office bearer'));
      return ok(toSummary(updated));
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'governance:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx, 'all');
      const header = [
        'Name',
        'Designation',
        'Body',
        'Phone',
        'Email',
        'Term Start',
        'Term End',
        'Status',
      ].join(',');
      const lines = rows.map((r) =>
        [
          csvField(r.name),
          csvField(r.designation),
          csvField(r.body),
          csvField(r.phone),
          csvField(r.email),
          csvField(r.termStartsOn),
          csvField(r.termEndsOn),
          csvField(r.isActive ? 'Active' : 'Former'),
        ].join(','),
      );
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type OfficerService = ReturnType<typeof createOfficerService>;
