import type { Db } from '@templeos/db';
import {
  donationListQuerySchema,
  recordDonationSchema,
  voidDonationSchema,
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
import { createDonationRepository } from './donation.repository';
import type {
  DevoteeGiving,
  DevoteeStatement,
  DonationPage,
  DonationStats,
  DonationSummary,
} from './donation.types';

/** Indian financial year runs April–March. Returns the FY start year for a date. */
function fyStartYearOf(date: Date): number {
  return date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

function fyRange(fyStartYear: number): { from: Date; to: Date; label: string } {
  return {
    from: new Date(Date.UTC(fyStartYear, 3, 1)),
    to: new Date(Date.UTC(fyStartYear + 1, 3, 1)),
    label: `${fyStartYear}–${fyStartYear + 1}`,
  };
}

function sumMinor(rows: { amount: string }[]): string {
  const minor = rows.reduce((n, r) => n + Math.round(Number.parseFloat(r.amount || '0') * 100), 0);
  return (minor / 100).toFixed(2);
}

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

export function createDonationService({ db }: { db: Db }) {
  const repo = createDonationRepository(db);

  const toSummary = (d: {
    id: string;
    receiptNumber: string;
    donorName: string;
    devoteeId: string | null;
    devoteeName?: string | null;
    categoryName?: string | null;
    amount: string;
    currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
    method: DonationSummary['method'];
    reference: string | null;
    note: string | null;
    donatedAt: Date;
    status: 'recorded' | 'void';
    voidReason: string | null;
  }): DonationSummary => ({
    id: d.id,
    receiptNumber: d.receiptNumber,
    donorName: d.donorName,
    devoteeId: d.devoteeId,
    devoteeName: d.devoteeName ?? null,
    categoryName: d.categoryName ?? null,
    amount: d.amount,
    currency: d.currency,
    method: d.method,
    reference: d.reference,
    note: d.note,
    donatedAt: d.donatedAt,
    status: d.status,
    voidReason: d.voidReason,
  });

  return {
    async recordDonation(ctx: TenantContext, rawInput: unknown): Promise<Result<DonationSummary>> {
      const auth = authorize(ctx, 'donations:write');
      if (!auth.ok) return auth;
      const parsed = recordDonationSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const result = await repo.record(ctx, parsed.data);
      if (result.kind === 'devotee_not_found') return err(notFound('Devotee'));
      if (result.kind === 'no_donor') {
        return err(domainError('VALIDATION', 'Select a devotee or enter a donor name'));
      }
      return ok(
        toSummary({ ...result.donation, categoryName: parsed.data.categoryName ?? null }),
      );
    },

    async listDonations(ctx: TenantContext, rawQuery: unknown): Promise<Result<DonationPage>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const parsed = donationListQuerySchema.safeParse(rawQuery ?? {});
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

    async getDonation(ctx: TenantContext, donationId: string): Promise<Result<DonationSummary>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, donationId);
      if (!row) return err(notFound('Donation'));
      return ok(toSummary(row));
    },

    /** Voiding keeps the row and receipt number — donations are never deleted. */
    async voidDonation(
      ctx: TenantContext,
      donationId: string,
      rawInput: unknown,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'donations:void');
      if (!auth.ok) return auth;
      const parsed = voidDonationSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const result = await repo.void(ctx, donationId, parsed.data.reason);
      if (result.kind === 'not_found') return err(notFound('Donation'));
      if (result.kind === 'already_void') {
        return err(conflict('This donation is already void'));
      }
      return ok(null);
    },

    async getStats(ctx: TenantContext): Promise<Result<DonationStats>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx));
    },

    async getDevoteeGiving(
      ctx: TenantContext,
      devoteeId: string,
    ): Promise<Result<DevoteeGiving>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const fyStartYear = fyStartYearOf(new Date());
      const fy = fyRange(fyStartYear);
      const g = await repo.devoteeGiving(ctx, devoteeId, fy.from, fy.to);
      return ok({
        currency: g.currency,
        lifetimeTotal: g.lifetime.total,
        lifetimeCount: g.lifetime.count,
        fyTotal: g.fy.total,
        fyCount: g.fy.count,
        fyLabel: fy.label,
        fyStartYear,
        recent: g.recent.map(toSummary),
      });
    },

    async getDevoteeStatement(
      ctx: TenantContext,
      devoteeId: string,
      fyStartYear: number,
    ): Promise<Result<DevoteeStatement>> {
      const auth = authorize(ctx, 'donations:read');
      if (!auth.ok) return auth;
      const fy = fyRange(fyStartYear);
      const rows = await repo.devoteeStatementRows(ctx, devoteeId, fy.from, fy.to);
      const items = rows.map(toSummary);
      return ok({
        fyStartYear,
        fyLabel: fy.label,
        currency: items[0]?.currency ?? 'INR',
        items,
        total: sumMinor(items),
        count: items.length,
      });
    },
  };
}

export type DonationService = ReturnType<typeof createDonationService>;
