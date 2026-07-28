import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, gt, gte, isNull, lt, sql } from 'drizzle-orm';
import {
  devoteeLoginTokens,
  devoteeSessions,
  devotees,
  donationCategories,
  donations,
  organizations,
  taxProfiles,
  withTenantContext,
  type Db,
} from '@templeos/db';

const LOGIN_TOKEN_TTL_MS = 15 * 60_000;
const SESSION_TTL_MS = 30 * 24 * 3_600_000;

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

export function createDonorPortalRepository(db: Db) {
  const guc = (organizationId: string) => ({ organizationId, userId: null });

  const baseDonationSelect = (tx: Parameters<Parameters<Db['transaction']>[0]>[0]) =>
    tx
      .select({
        id: donations.id,
        receiptNumber: donations.receiptNumber,
        amount: donations.amount,
        currency: donations.currency,
        method: donations.method,
        categoryName: donationCategories.name,
        donatedAt: donations.donatedAt,
        status: donations.status,
      })
      .from(donations)
      .leftJoin(donationCategories, eq(donations.categoryId, donationCategories.id));

  return {
    /** Looks up an active devotee by email within one org — used to gate a login request. */
    async findDevoteeByEmail(organizationId: string, email: string) {
      return withTenantContext(db, guc(organizationId), async (tx) => {
        const [row] = await tx
          .select({ id: devotees.id, fullName: devotees.fullName })
          .from(devotees)
          .where(
            and(
              eq(devotees.organizationId, organizationId),
              eq(devotees.status, 'active'),
              isNull(devotees.deletedAt),
              eq(devotees.email, email),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    async createLoginToken(organizationId: string, devoteeId: string): Promise<string> {
      const token = newToken();
      await withTenantContext(db, guc(organizationId), (tx) =>
        tx.insert(devoteeLoginTokens).values({
          organizationId,
          devoteeId,
          token,
          expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
        }),
      );
      return token;
    },

    /** Consumes an unexpired, unused login token. Returns the devotee it belongs to, or null. */
    async consumeLoginToken(organizationId: string, token: string) {
      return withTenantContext(db, guc(organizationId), async (tx) => {
        const [row] = await tx
          .select({ id: devoteeLoginTokens.id, devoteeId: devoteeLoginTokens.devoteeId })
          .from(devoteeLoginTokens)
          .where(
            and(
              eq(devoteeLoginTokens.organizationId, organizationId),
              eq(devoteeLoginTokens.token, token),
              isNull(devoteeLoginTokens.consumedAt),
              gt(devoteeLoginTokens.expiresAt, new Date()),
            ),
          )
          .limit(1);
        if (!row) return null;

        await tx
          .update(devoteeLoginTokens)
          .set({ consumedAt: new Date() })
          .where(eq(devoteeLoginTokens.id, row.id));

        const [devotee] = await tx
          .select({ id: devotees.id, fullName: devotees.fullName })
          .from(devotees)
          .where(eq(devotees.id, row.devoteeId))
          .limit(1);
        return devotee ?? null;
      });
    },

    async createSession(organizationId: string, devoteeId: string): Promise<string> {
      const token = newToken();
      await withTenantContext(db, guc(organizationId), (tx) =>
        tx.insert(devoteeSessions).values({
          organizationId,
          devoteeId,
          token,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        }),
      );
      return token;
    },

    /** Resolves a session token to the devotee it belongs to; touches lastSeenAt. */
    async findSession(organizationId: string, token: string) {
      return withTenantContext(db, guc(organizationId), async (tx) => {
        const [row] = await tx
          .select({
            id: devoteeSessions.id,
            devoteeId: devoteeSessions.devoteeId,
            devoteeName: devotees.fullName,
          })
          .from(devoteeSessions)
          .innerJoin(devotees, eq(devoteeSessions.devoteeId, devotees.id))
          .where(
            and(
              eq(devoteeSessions.organizationId, organizationId),
              eq(devoteeSessions.token, token),
              gt(devoteeSessions.expiresAt, new Date()),
              isNull(devotees.deletedAt),
            ),
          )
          .limit(1);
        if (!row) return null;

        await tx
          .update(devoteeSessions)
          .set({ lastSeenAt: new Date() })
          .where(eq(devoteeSessions.id, row.id));

        return { devoteeId: row.devoteeId, devoteeName: row.devoteeName };
      });
    },

    async deleteSession(organizationId: string, token: string): Promise<void> {
      await withTenantContext(db, guc(organizationId), (tx) =>
        tx
          .delete(devoteeSessions)
          .where(
            and(
              eq(devoteeSessions.organizationId, organizationId),
              eq(devoteeSessions.token, token),
            ),
          ),
      );
    },

    /** Lifetime + current-FY giving totals, plus the 5 most recent recorded donations. */
    async givingSummary(organizationId: string, devoteeId: string, fyFrom: Date, fyTo: Date) {
      return withTenantContext(db, guc(organizationId), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const recorded = and(
          eq(donations.organizationId, organizationId),
          eq(donations.devoteeId, devoteeId),
          eq(donations.status, 'recorded'),
        );
        const agg = {
          total: sql<string>`coalesce(sum(${donations.amount}), '0.00')`,
          count: count(),
        };

        const [[lifetime], [fy], recent] = await Promise.all([
          tx.select(agg).from(donations).where(recorded),
          tx
            .select(agg)
            .from(donations)
            .where(and(recorded, gte(donations.donatedAt, fyFrom), lt(donations.donatedAt, fyTo))),
          baseDonationSelect(tx).where(recorded).orderBy(desc(donations.donatedAt)).limit(5),
        ]);

        return {
          currency: org.currency,
          lifetime: { total: lifetime?.total ?? '0.00', count: lifetime?.count ?? 0 },
          fy: { total: fy?.total ?? '0.00', count: fy?.count ?? 0 },
          recent,
        };
      });
    },

    /** Paginated recorded donations for one devotee. */
    async listDonations(
      organizationId: string,
      devoteeId: string,
      query: { page: number; pageSize: number },
    ) {
      return withTenantContext(db, guc(organizationId), async (tx) => {
        const where = and(
          eq(donations.organizationId, organizationId),
          eq(donations.devoteeId, devoteeId),
          eq(donations.status, 'recorded'),
        );
        const [items, [totalRow]] = await Promise.all([
          baseDonationSelect(tx)
            .where(where)
            .orderBy(desc(donations.donatedAt))
            .limit(query.pageSize)
            .offset((query.page - 1) * query.pageSize),
          tx.select({ value: count() }).from(donations).where(where),
        ]);
        return { items, total: totalRow?.value ?? 0 };
      });
    },

    /** A donation's receipt data, only when it belongs to this devotee in this org. */
    async receiptData(organizationId: string, devoteeId: string, donationId: string) {
      return withTenantContext(db, guc(organizationId), async (tx) => {
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
            and(
              eq(donations.id, donationId),
              eq(donations.organizationId, organizationId),
              eq(donations.devoteeId, devoteeId),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },
  };
}

export type DonorPortalRepository = ReturnType<typeof createDonorPortalRepository>;
