import type { Db } from '@templeos/db';
import { grantListQuerySchema, grantSchema } from '@templeos/validators';
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
import { createGrantRepository } from './grant.repository';
import type { GrantDetail, GrantLedgerEntry, GrantStats, GrantSummary } from './grant.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

const paise = (v: string) => Math.round(Number(v) * 100);
const money = (minor: number) => (minor / 100).toFixed(2);

export function createGrantService({ db }: { db: Db }) {
  const repo = createGrantRepository(db);

  const toSummary = (g: {
    id: string;
    funder: string;
    title: string;
    reference: string | null;
    sanctionedOn: string | null;
    purpose: string | null;
    status: 'active' | 'closed';
    sanctionedAmount: string;
    received: string;
    utilized: string;
  }): GrantSummary => {
    const received = paise(g.received);
    const utilized = paise(g.utilized);
    const sanctioned = paise(g.sanctionedAmount);
    return {
      id: g.id,
      funder: g.funder,
      title: g.title,
      reference: g.reference,
      sanctionedOn: g.sanctionedOn,
      purpose: g.purpose,
      status: g.status,
      sanctionedAmount: money(sanctioned),
      received: money(received),
      utilized: money(utilized),
      unspent: money(received - utilized),
      pendingRelease: money(Math.max(0, sanctioned - received)),
    };
  };

  return {
    async listGrants(ctx: TenantContext, rawQuery: unknown): Promise<Result<GrantSummary[]>> {
      const auth = authorize(ctx, 'grants:read');
      if (!auth.ok) return auth;
      const parsed = grantListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const rows = await repo.list(ctx, parsed.data.scope);
      return ok(rows.map(toSummary));
    },

    /** {id, funder+title} for the grant selectors on the donation/expense forms. */
    async listActiveOptions(
      ctx: TenantContext,
    ): Promise<Result<Array<{ id: string; name: string }>>> {
      const auth = authorize(ctx, 'grants:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx, 'active');
      return ok(rows.map((g) => ({ id: g.id, name: `${g.funder} — ${g.title}` })));
    },

    async getGrantDetail(ctx: TenantContext, grantId: string): Promise<Result<GrantDetail>> {
      const auth = authorize(ctx, 'grants:read');
      if (!auth.ok) return auth;
      const grant = await repo.findById(ctx, grantId);
      if (!grant) return err(notFound('Grant'));
      const { currency, receipts, utilizations } = await repo.ledger(ctx, grantId);
      const toEntry = (r: { id: string; ref: string; party: string; amount: string; at: Date }): GrantLedgerEntry => ({
        id: r.id,
        ref: r.ref,
        party: r.party,
        amount: Number(r.amount).toFixed(2),
        at: r.at,
      });
      return ok({
        grant: toSummary(grant),
        currency,
        receipts: receipts.map(toEntry),
        utilizations: utilizations.map(toEntry),
      });
    },

    async getStats(ctx: TenantContext): Promise<Result<GrantStats>> {
      const auth = authorize(ctx, 'grants:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx));
    },

    async createGrant(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'grants:write');
      if (!auth.ok) return auth;
      const parsed = grantSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.create(ctx, parsed.data);
      return ok({ id });
    },

    async updateGrant(
      ctx: TenantContext,
      grantId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'grants:write');
      if (!auth.ok) return auth;
      const parsed = grantSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.update(ctx, grantId, parsed.data);
      if (!id) return err(notFound('Grant'));
      return ok({ id });
    },

    async setGrantStatus(
      ctx: TenantContext,
      grantId: string,
      status: 'active' | 'closed',
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'grants:write');
      if (!auth.ok) return auth;
      const id = await repo.setStatus(ctx, grantId, status);
      if (!id) return err(notFound('Grant'));
      return ok(null);
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'grants:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx);
      const header = [
        'Funder',
        'Title',
        'Reference',
        'Sanctioned',
        'Received',
        'Utilized',
        'Unspent',
        'Status',
      ].join(',');
      const lines = rows.map((r) => {
        const g = toSummary(r);
        return [
          csvField(g.funder),
          csvField(g.title),
          csvField(g.reference),
          csvField(g.sanctionedAmount),
          csvField(g.received),
          csvField(g.utilized),
          csvField(g.unspent),
          csvField(g.status),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type GrantService = ReturnType<typeof createGrantService>;
