import type { Db } from '@templeos/db';
import {
  cancelPledgeSchema,
  createPledgeSchema,
  fulfilPledgeSchema,
  pledgeListQuerySchema,
} from '@templeos/validators';
import {
  authorize,
  conflict,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { csvField } from '../reports/report.service';
import { createPledgeRepository } from './pledge.repository';
import type {
  PledgeDetail,
  PledgeProgress,
  PledgeStats,
  PledgeSummary,
} from './pledge.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

const paise = (v: string | number) => Math.round(Number(v) * 100);

export function createPledgeService({ db }: { db: Db }) {
  const repo = createPledgeRepository(db);

  const toSummary = (p: {
    id: string;
    donorName: string;
    devoteeId: string | null;
    campaignId: string | null;
    campaignTitle: string | null;
    amount: string;
    currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
    pledgedOn: string;
    dueDate: string | null;
    note: string | null;
    status: 'open' | 'cancelled';
    cancelReason: string | null;
    received: string;
  }): PledgeSummary => {
    const amountPaise = paise(p.amount);
    const receivedPaise = paise(p.received);
    const outstandingPaise = Math.max(0, amountPaise - receivedPaise);
    const progress: PledgeProgress =
      receivedPaise <= 0 ? 'unfulfilled' : receivedPaise >= amountPaise ? 'fulfilled' : 'partial';
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: p.id,
      donorName: p.donorName,
      devoteeId: p.devoteeId,
      campaignId: p.campaignId,
      campaignTitle: p.campaignTitle,
      amount: Number(p.amount).toFixed(2),
      currency: p.currency,
      pledgedOn: p.pledgedOn,
      dueDate: p.dueDate,
      note: p.note,
      status: p.status,
      cancelReason: p.cancelReason,
      received: Number(p.received).toFixed(2),
      outstanding: (outstandingPaise / 100).toFixed(2),
      progress,
      isOverdue:
        p.status === 'open' &&
        outstandingPaise > 0 &&
        p.dueDate !== null &&
        p.dueDate < today,
    };
  };

  return {
    async listPledges(ctx: TenantContext, rawQuery: unknown): Promise<Result<PledgeSummary[]>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const parsed = pledgeListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const rows = await repo.list(ctx, {
        search: parsed.data.search ?? null,
        scope: parsed.data.scope,
      });
      return ok(rows.map(toSummary));
    },

    async getPledgeDetail(ctx: TenantContext, pledgeId: string): Promise<Result<PledgeDetail>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const pledge = await repo.findById(ctx, pledgeId);
      if (!pledge) return err(notFound('Pledge'));
      const fulfilments = await repo.fulfilments(ctx, pledgeId);
      return ok({ pledge: toSummary(pledge), fulfilments });
    },

    async getStats(ctx: TenantContext): Promise<Result<PledgeStats>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx));
    },

    async createPledge(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;
      const parsed = createPledgeSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.create(ctx, parsed.data);
      if (result.kind === 'devotee_not_found') return err(notFound('Devotee'));
      return ok({ id: result.id });
    },

    /** Records a receipt against a pledge; returns the donation receipt number. */
    async fulfilPledge(
      ctx: TenantContext,
      pledgeId: string,
      rawInput: unknown,
    ): Promise<Result<{ receiptNumber: string }>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;
      const parsed = fulfilPledgeSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.fulfil(ctx, pledgeId, parsed.data);
      if (result.kind === 'not_found') return err(notFound('Pledge'));
      if (result.kind === 'cancelled') return err(conflict('This pledge has been cancelled'));
      if (result.kind === 'overpay') {
        return err(
          domainError('VALIDATION', `Receipt exceeds the ${result.outstanding} still outstanding`),
        );
      }
      return ok({ receiptNumber: result.receiptNumber });
    },

    async cancelPledge(
      ctx: TenantContext,
      pledgeId: string,
      rawInput: unknown,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;
      const parsed = cancelPledgeSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.cancel(ctx, pledgeId, parsed.data.reason);
      if (result.kind === 'not_found') return err(notFound('Pledge'));
      if (result.kind === 'already_cancelled') return err(conflict('This pledge is already cancelled'));
      return ok(null);
    },

    /** Pledge register: every pledge with derived received/outstanding. */
    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx);
      const header = [
        'Donor',
        'Campaign',
        'Pledged On',
        'Due Date',
        'Amount',
        'Received',
        'Outstanding',
        'Currency',
        'Status',
      ].join(',');
      const lines = rows.map((r) => {
        const p = toSummary(r);
        return [
          csvField(p.donorName),
          csvField(p.campaignTitle),
          csvField(p.pledgedOn),
          csvField(p.dueDate),
          csvField(p.amount),
          csvField(p.received),
          csvField(p.outstanding),
          csvField(p.currency),
          csvField(p.status === 'cancelled' ? 'cancelled' : p.progress),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type PledgeService = ReturnType<typeof createPledgeService>;
