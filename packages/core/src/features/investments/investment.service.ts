import type { Db } from '@templeos/db';
import {
  investmentListQuerySchema,
  investmentSchema,
  type InvestmentStatus,
  type InvestmentType,
} from '@templeos/validators';
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
import { createInvestmentRepository } from './investment.repository';
import type { InvestmentStats, InvestmentSummary } from './investment.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

const paise = (v: string) => Math.round(Number(v) * 100);
const money = (minor: number) => (minor / 100).toFixed(2);

export function createInvestmentService({ db }: { db: Db }) {
  const repo = createInvestmentRepository(db);

  const toSummary = (i: {
    id: string;
    institution: string;
    type: InvestmentType;
    fundId: string | null;
    fundName: string | null;
    reference: string | null;
    status: InvestmentStatus;
    investedOn: string;
    maturityDate: string | null;
    interestRate: string | null;
    principal: string;
    maturityValue: string | null;
  }): InvestmentSummary => {
    const principal = paise(i.principal);
    const maturityValue = i.maturityValue == null ? null : paise(i.maturityValue);
    return {
      id: i.id,
      institution: i.institution,
      type: i.type,
      fundId: i.fundId,
      fundName: i.fundName,
      reference: i.reference,
      status: i.status,
      investedOn: i.investedOn,
      maturityDate: i.maturityDate,
      interestRate: i.interestRate == null ? null : Number(i.interestRate).toString(),
      principal: money(principal),
      maturityValue: maturityValue == null ? null : money(maturityValue),
      interestEarned: maturityValue == null ? null : money(maturityValue - principal),
    };
  };

  return {
    async listInvestments(
      ctx: TenantContext,
      rawQuery: unknown,
    ): Promise<Result<InvestmentSummary[]>> {
      const auth = authorize(ctx, 'investments:read');
      if (!auth.ok) return auth;
      const parsed = investmentListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const rows = await repo.list(ctx, parsed.data.scope);
      return ok(rows.map(toSummary));
    },

    async getInvestment(
      ctx: TenantContext,
      investmentId: string,
    ): Promise<Result<InvestmentSummary>> {
      const auth = authorize(ctx, 'investments:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, investmentId);
      if (!row) return err(notFound('Investment'));
      return ok(toSummary(row));
    },

    async getStats(ctx: TenantContext): Promise<Result<InvestmentStats>> {
      const auth = authorize(ctx, 'investments:read');
      if (!auth.ok) return auth;
      const s = await repo.stats(ctx);
      const invested = paise(s.totalInvested);
      const maturity = paise(s.totalMaturityValue);
      return ok({
        currency: s.currency,
        totalInvested: money(invested),
        totalMaturityValue: money(maturity),
        expectedInterest: money(Math.max(0, maturity - invested)),
        activeCount: s.activeCount,
      });
    },

    async createInvestment(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'investments:write');
      if (!auth.ok) return auth;
      const parsed = investmentSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      // A stated maturity value cannot be below the principal.
      if (parsed.data.maturityValue != null && parsed.data.maturityValue < parsed.data.principal) {
        return err(domainError('VALIDATION', 'Maturity value cannot be below the principal'));
      }
      const id = await repo.create(ctx, parsed.data);
      return ok({ id });
    },

    async updateInvestment(
      ctx: TenantContext,
      investmentId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'investments:write');
      if (!auth.ok) return auth;
      const parsed = investmentSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      if (parsed.data.maturityValue != null && parsed.data.maturityValue < parsed.data.principal) {
        return err(domainError('VALIDATION', 'Maturity value cannot be below the principal'));
      }
      const id = await repo.update(ctx, investmentId, parsed.data);
      if (!id) return err(notFound('Investment'));
      return ok({ id });
    },

    async setInvestmentStatus(
      ctx: TenantContext,
      investmentId: string,
      status: InvestmentStatus,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'investments:write');
      if (!auth.ok) return auth;
      const id = await repo.setStatus(ctx, investmentId, status);
      if (!id) return err(notFound('Investment'));
      return ok(null);
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'investments:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx);
      const header = [
        'Institution',
        'Type',
        'Fund',
        'Reference',
        'Invested on',
        'Maturity date',
        'Rate %',
        'Principal',
        'Maturity value',
        'Interest',
        'Status',
      ].join(',');
      const lines = rows.map((r) => {
        const i = toSummary(r);
        return [
          csvField(i.institution),
          csvField(i.type),
          csvField(i.fundName),
          csvField(i.reference),
          csvField(i.investedOn),
          csvField(i.maturityDate),
          csvField(i.interestRate),
          csvField(i.principal),
          csvField(i.maturityValue),
          csvField(i.interestEarned),
          csvField(i.status),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type InvestmentService = ReturnType<typeof createInvestmentService>;
