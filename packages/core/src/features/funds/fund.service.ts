import type { Db } from '@templeos/db';
import { fundListQuerySchema, fundSchema } from '@templeos/validators';
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
import { createFundRepository } from './fund.repository';
import type { FundDetail, FundStats, FundSummary } from './fund.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

const paise = (v: string) => Math.round(Number(v) * 100);

export function createFundService({ db }: { db: Db }) {
  const repo = createFundRepository(db);

  const toSummary = (f: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    income: string;
    expense: string;
  }): FundSummary => {
    const balance = paise(f.income) - paise(f.expense);
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      isActive: f.isActive,
      income: Number(f.income).toFixed(2),
      expense: Number(f.expense).toFixed(2),
      balance: (balance / 100).toFixed(2),
    };
  };

  return {
    async listFunds(ctx: TenantContext, rawQuery: unknown): Promise<Result<FundSummary[]>> {
      const auth = authorize(ctx, 'funds:read');
      if (!auth.ok) return auth;
      const parsed = fundListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const rows = await repo.list(ctx, parsed.data.scope);
      return ok(rows.map(toSummary));
    },

    /** {id, name} for the fund selectors on the donation/expense forms. */
    async listActiveOptions(
      ctx: TenantContext,
    ): Promise<Result<Array<{ id: string; name: string }>>> {
      const auth = authorize(ctx, 'funds:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx, 'active');
      return ok(rows.map((f) => ({ id: f.id, name: f.name })));
    },

    async getFundDetail(ctx: TenantContext, fundId: string): Promise<Result<FundDetail>> {
      const auth = authorize(ctx, 'funds:read');
      if (!auth.ok) return auth;
      const fund = await repo.findById(ctx, fundId);
      if (!fund) return err(notFound('Fund'));
      const { income, expenditure } = await repo.ledger(ctx, fundId);
      return ok({
        fund: toSummary(fund),
        income: income.map((d) => ({
          id: d.id,
          ref: d.receiptNumber,
          party: d.donorName,
          amount: Number(d.amount).toFixed(2),
          at: d.at,
        })),
        expenditure: expenditure.map((e) => ({
          id: e.id,
          ref: e.voucherNumber,
          party: e.paidTo,
          amount: Number(e.amount).toFixed(2),
          at: e.at,
        })),
      });
    },

    async getStats(ctx: TenantContext): Promise<Result<FundStats>> {
      const auth = authorize(ctx, 'funds:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx));
    },

    async createFund(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'funds:write');
      if (!auth.ok) return auth;
      const parsed = fundSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.create(ctx, parsed.data);
      return ok({ id });
    },

    async updateFund(
      ctx: TenantContext,
      fundId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'funds:write');
      if (!auth.ok) return auth;
      const parsed = fundSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.update(ctx, fundId, parsed.data);
      if (!id) return err(notFound('Fund'));
      return ok({ id });
    },

    async setFundActive(
      ctx: TenantContext,
      fundId: string,
      isActive: boolean,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'funds:write');
      if (!auth.ok) return auth;
      const id = await repo.setActive(ctx, fundId, isActive);
      if (!id) return err(notFound('Fund'));
      return ok(null);
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'funds:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx);
      const header = ['Fund', 'Description', 'Income', 'Expense', 'Balance', 'Status'].join(',');
      const lines = rows.map((r) => {
        const f = toSummary(r);
        return [
          csvField(f.name),
          csvField(f.description),
          csvField(f.income),
          csvField(f.expense),
          csvField(f.balance),
          csvField(f.isActive ? 'active' : 'inactive'),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type FundService = ReturnType<typeof createFundService>;
