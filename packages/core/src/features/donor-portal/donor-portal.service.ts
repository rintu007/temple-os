import type { Db } from '@templeos/db';
import { err, notFound, ok, type Result } from '../../shared';
import { createDonorPortalRepository } from './donor-portal.repository';
import type {
  PortalDonationPage,
  PortalGivingSummary,
  PortalReceipt,
  PortalSession,
  PortalStatement,
} from './donor-portal.types';

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

/** Sums via integer cents — avoids float drift from naively adding decimal-string amounts. */
function sumMinor(rows: { amount: string }[]): string {
  const minor = rows.reduce((n, r) => n + Math.round(Number.parseFloat(r.amount || '0') * 100), 0);
  return (minor / 100).toFixed(2);
}

export function createDonorPortalService({ db }: { db: Db }) {
  const repo = createDonorPortalRepository(db);

  return {
    /**
     * Starts a login: if the email matches an active devotee in this org, a
     * one-time token is created and returned for the caller to email. Always
     * resolves (never errors) so the response can't be used to enumerate
     * which emails are registered.
     */
    async requestLogin(
      organizationId: string,
      email: string,
    ): Promise<Result<{ token: string; devoteeName: string } | null>> {
      const normalized = email.trim().toLowerCase();
      if (!normalized) return ok(null);

      const devotee = await repo.findDevoteeByEmail(organizationId, normalized);
      if (!devotee) return ok(null);

      const token = await repo.createLoginToken(organizationId, devotee.id);
      return ok({ token, devoteeName: devotee.fullName });
    },

    /** Exchanges a login token for a new portal session token. */
    async verifyLogin(
      organizationId: string,
      token: string,
    ): Promise<Result<{ sessionToken: string; devoteeName: string }>> {
      const devotee = await repo.consumeLoginToken(organizationId, token);
      if (!devotee) return err(notFound('Login link'));

      const sessionToken = await repo.createSession(organizationId, devotee.id);
      return ok({ sessionToken, devoteeName: devotee.fullName });
    },

    /** Resolves a session cookie value to the devotee it belongs to. */
    async getSession(organizationId: string, sessionToken: string): Promise<PortalSession | null> {
      const row = await repo.findSession(organizationId, sessionToken);
      if (!row) return null;
      return { organizationId, devoteeId: row.devoteeId, devoteeName: row.devoteeName };
    },

    async logout(organizationId: string, sessionToken: string): Promise<void> {
      await repo.deleteSession(organizationId, sessionToken);
    },

    async getGivingSummary(session: PortalSession): Promise<Result<PortalGivingSummary>> {
      const fy = fyRange(fyStartYearOf(new Date()));
      const g = await repo.givingSummary(session.organizationId, session.devoteeId, fy.from, fy.to);
      return ok({
        currency: g.currency,
        lifetimeTotal: g.lifetime.total,
        lifetimeCount: g.lifetime.count,
        fyTotal: g.fy.total,
        fyCount: g.fy.count,
        fyLabel: fy.label,
        recent: g.recent,
      });
    },

    async listDonations(
      session: PortalSession,
      page: number,
    ): Promise<Result<PortalDonationPage>> {
      const pageSize = 20;
      const safePage = Math.max(1, page);
      const { items, total } = await repo.listDonations(
        session.organizationId,
        session.devoteeId,
        { page: safePage, pageSize },
      );
      return ok({ items, total });
    },

    /**
     * A devotee's own annual statement — the same data as the staff-side
     * devotee statement (donation.service.ts#getDevoteeStatement), but scoped
     * by the portal session's devoteeId directly rather than an RBAC ctx,
     * since a devotee isn't a staff member with permissions to check.
     */
    async getStatement(session: PortalSession, fyStartYear: number): Promise<Result<PortalStatement>> {
      const fy = fyRange(fyStartYear);
      const items = await repo.statementRows(
        session.organizationId,
        session.devoteeId,
        fy.from,
        fy.to,
      );
      return ok({
        fyStartYear,
        fyLabel: fy.label,
        currency: items[0]?.currency ?? 'INR',
        items,
        total: sumMinor(items),
        count: items.length,
      });
    },

    /** The printable 80G receipt for one donation — only if it belongs to this devotee. */
    async getReceipt(session: PortalSession, donationId: string): Promise<Result<PortalReceipt>> {
      const row = await repo.receiptData(session.organizationId, session.devoteeId, donationId);
      if (!row) return err(notFound('Donation'));

      const tax =
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
        financialYearLabel: fyRange(fyStartYearOf(row.donatedAt)).label,
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

export type DonorPortalService = ReturnType<typeof createDonorPortalService>;
