import type { Db } from '@templeos/db';
import { recordPrasadamSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createPrasadamRepository } from './prasadam.repository';
import type { PrasadamSessionSummary, PrasadamStats } from './prasadam.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

function toSummary(row: {
  id: string;
  servedOn: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'prasadam';
  servedCount: number;
  sponsorName: string | null;
  note: string | null;
  createdAt: Date;
  sponsorReceiptNumber: string | null;
  sponsorAmount: string | null;
  currency: 'INR' | 'BDT' | null;
}): PrasadamSessionSummary {
  return {
    id: row.id,
    servedOn: row.servedOn,
    meal: row.meal,
    servedCount: row.servedCount,
    sponsorName: row.sponsorName,
    sponsorReceiptNumber: row.sponsorReceiptNumber,
    sponsorAmount: row.sponsorAmount,
    currency: row.currency,
    note: row.note,
    createdAt: row.createdAt,
  };
}

export function createPrasadamService({ db }: { db: Db }) {
  const repo = createPrasadamRepository(db);

  return {
    async listSessions(ctx: TenantContext): Promise<Result<PrasadamSessionSummary[]>> {
      const auth = authorize(ctx, 'prasadam:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx);
      return ok(rows.map(toSummary));
    },

    async getStats(ctx: TenantContext): Promise<Result<PrasadamStats>> {
      const auth = authorize(ctx, 'prasadam:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx));
    },

    async recordSession(
      ctx: TenantContext,
      rawInput: unknown,
    ): Promise<Result<PrasadamSessionSummary>> {
      const auth = authorize(ctx, 'prasadam:write');
      if (!auth.ok) return auth;
      const parsed = recordPrasadamSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const sponsorAmount = parsed.data.sponsorAmount ?? 0;
      const { session, sponsorDonationId } = await repo.record(ctx, parsed.data, sponsorAmount);

      return ok(
        toSummary({
          ...session,
          sponsorReceiptNumber: null,
          sponsorAmount: sponsorDonationId ? sponsorAmount.toFixed(2) : null,
          currency: null,
        }),
      );
    },
  };
}

export type PrasadamService = ReturnType<typeof createPrasadamService>;
