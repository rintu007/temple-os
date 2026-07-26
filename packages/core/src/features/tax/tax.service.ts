import type { Db } from '@templeos/db';
import { taxProfileSchema } from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { financialYearOf, financialYearRange } from '../statements/statement.service';
import { createTaxRepository } from './tax.repository';
import type { Receipt80G, TaxProfile } from './tax.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

export function createTaxService({ db }: { db: Db }) {
  const repo = createTaxRepository(db);

  return {
    async getProfile(ctx: TenantContext): Promise<Result<TaxProfile | null>> {
      const guard = authorize(ctx, 'tax:read');
      if (!guard.ok) return guard;
      return ok(await repo.getProfile(ctx));
    },

    async saveProfile(ctx: TenantContext, rawInput: unknown): Promise<Result<TaxProfile>> {
      const guard = authorize(ctx, 'tax:write');
      if (!guard.ok) return guard;

      const parsed = taxProfileSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      await repo.upsertProfile(ctx, parsed.data);
      const saved = await repo.getProfile(ctx);
      if (!saved) throw new Error('tax profile not visible after save');
      return ok(saved);
    },

    /** Build the printable 80G receipt for one donation. */
    async getReceipt(ctx: TenantContext, donationId: string): Promise<Result<Receipt80G>> {
      const guard = authorize(ctx, 'tax:read');
      if (!guard.ok) return guard;

      const row = await repo.receiptData(ctx, donationId);
      if (!row) return err(notFound('Donation'));

      const tax: TaxProfile | null =
        row.taxLegalName && row.taxShowOnReceipt
          ? {
              legalName: row.taxLegalName,
              pan: row.taxPan,
              registrationNumber: row.taxRegistrationNumber ?? '',
              validFrom: row.taxValidFrom,
              validUntil: row.taxValidUntil,
              showOnReceipt: row.taxShowOnReceipt,
            }
          : null;

      return ok({
        receiptNumber: row.receiptNumber,
        donatedOn: row.donatedAt,
        financialYearLabel: financialYearRange(financialYearOf(row.donatedAt)).label,
        donorName: row.donorName,
        donorPan: row.donorPan,
        amount: row.amount,
        currency: row.currency,
        method: row.method,
        categoryName: row.categoryName,
        isVoid: row.status !== 'recorded',
        organizationName: row.organizationName,
        tax,
      });
    },
  };
}

export type TaxService = ReturnType<typeof createTaxService>;
