import { and, eq } from 'drizzle-orm';
import {
  auditLogs,
  donationCategories,
  donations,
  organizations,
  taxProfiles,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { TaxProfileInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

export function createTaxRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async getProfile(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select({
            legalName: taxProfiles.legalName,
            pan: taxProfiles.pan,
            registrationNumber: taxProfiles.registrationNumber,
            validFrom: taxProfiles.validFrom,
            validUntil: taxProfiles.validUntil,
            showOnReceipt: taxProfiles.showOnReceipt,
          })
          .from(taxProfiles)
          .where(eq(taxProfiles.organizationId, ctx.organizationId))
          .limit(1);
        return row ?? null;
      });
    },

    async upsertProfile(ctx: TenantContext, input: TaxProfileInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        await tx
          .insert(taxProfiles)
          .values({
            organizationId: ctx.organizationId,
            legalName: input.legalName,
            pan: input.pan ?? null,
            registrationNumber: input.registrationNumber,
            validFrom: input.validFrom ?? null,
            validUntil: input.validUntil ?? null,
            showOnReceipt: input.showOnReceipt,
          })
          .onConflictDoUpdate({
            target: taxProfiles.organizationId,
            set: {
              legalName: input.legalName,
              pan: input.pan ?? null,
              registrationNumber: input.registrationNumber,
              validFrom: input.validFrom ?? null,
              validUntil: input.validUntil ?? null,
              showOnReceipt: input.showOnReceipt,
            },
          });

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'tax_profile.saved',
          entityType: 'tax_profile',
          entityId: ctx.organizationId,
          after: {
            registrationNumber: input.registrationNumber,
            showOnReceipt: input.showOnReceipt,
          },
        });
      });
    },

    /** A donation joined with its org name, category and the org tax profile. */
    async receiptData(ctx: TenantContext, donationId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select({
            receiptNumber: donations.receiptNumber,
            donatedAt: donations.donatedAt,
            donorName: donations.donorName,
            donorPan: donations.donorPan,
            amount: donations.amount,
            currency: donations.currency,
            method: donations.method,
            status: donations.status,
            categoryName: donationCategories.name,
            organizationName: organizations.name,
            taxLegalName: taxProfiles.legalName,
            taxPan: taxProfiles.pan,
            taxRegistrationNumber: taxProfiles.registrationNumber,
            taxValidFrom: taxProfiles.validFrom,
            taxValidUntil: taxProfiles.validUntil,
            taxShowOnReceipt: taxProfiles.showOnReceipt,
          })
          .from(donations)
          .innerJoin(organizations, eq(donations.organizationId, organizations.id))
          .leftJoin(donationCategories, eq(donations.categoryId, donationCategories.id))
          .leftJoin(taxProfiles, eq(taxProfiles.organizationId, donations.organizationId))
          .where(
            and(eq(donations.id, donationId), eq(donations.organizationId, ctx.organizationId)),
          )
          .limit(1);
        return row ?? null;
      });
    },
  };
}

export type TaxRepository = ReturnType<typeof createTaxRepository>;
