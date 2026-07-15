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
import type { DonationPage, DonationStats, DonationSummary } from './donation.types';

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
    currency: 'INR' | 'BDT';
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
  };
}

export type DonationService = ReturnType<typeof createDonationService>;
