import type { Db } from '@templeos/db';
import { accountListQuerySchema, accountSchema } from '@templeos/validators';
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
import { createAccountRepository } from './account.repository';
import type {
  AccountMovement,
  AccountPassbook,
  AccountStats,
  AccountSummary,
} from './account.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

const paise = (v: string) => Math.round(Number(v) * 100);
const money = (minor: number) => (minor / 100).toFixed(2);

/** Mask all but the last four characters of an account number. */
function maskAccountNumber(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, '');
  if (trimmed.length <= 4) return trimmed;
  return `••••${trimmed.slice(-4)}`;
}

export function createAccountService({ db }: { db: Db }) {
  const repo = createAccountRepository(db);

  const toSummary = (a: {
    id: string;
    name: string;
    type: 'bank' | 'cash';
    bankName: string | null;
    accountNumber: string | null;
    openingBalance: string;
    isActive: boolean;
    received: string;
    paid: string;
    transfersIn: string;
    transfersOut: string;
  }): AccountSummary => {
    const balance =
      paise(a.openingBalance) +
      paise(a.received) +
      paise(a.transfersIn) -
      paise(a.paid) -
      paise(a.transfersOut);
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      bankName: a.bankName,
      accountNumberMasked: maskAccountNumber(a.accountNumber),
      isActive: a.isActive,
      openingBalance: Number(a.openingBalance).toFixed(2),
      received: Number(a.received).toFixed(2),
      paid: Number(a.paid).toFixed(2),
      transfersIn: Number(a.transfersIn).toFixed(2),
      transfersOut: Number(a.transfersOut).toFixed(2),
      balance: money(balance),
    };
  };

  return {
    async listAccounts(ctx: TenantContext, rawQuery: unknown): Promise<Result<AccountSummary[]>> {
      const auth = authorize(ctx, 'accounts:read');
      if (!auth.ok) return auth;
      const parsed = accountListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const rows = await repo.list(ctx, parsed.data.scope);
      return ok(rows.map(toSummary));
    },

    /** {id, name} for the account selectors on the donation/expense forms. */
    async listActiveOptions(
      ctx: TenantContext,
    ): Promise<Result<Array<{ id: string; name: string }>>> {
      const auth = authorize(ctx, 'accounts:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx, 'active');
      return ok(rows.map((a) => ({ id: a.id, name: a.name })));
    },

    async getStats(ctx: TenantContext): Promise<Result<AccountStats>> {
      const auth = authorize(ctx, 'accounts:read');
      if (!auth.ok) return auth;
      return ok(await repo.stats(ctx));
    },

    /** Passbook: chronological movements with a running balance from opening. */
    async getPassbook(ctx: TenantContext, accountId: string): Promise<Result<AccountPassbook>> {
      const auth = authorize(ctx, 'accounts:read');
      if (!auth.ok) return auth;

      const account = await repo.findById(ctx, accountId);
      if (!account) return err(notFound('Account'));

      const { currency, receipts, payments, transfers } = await repo.movements(ctx, accountId);

      type Raw = { id: string; ref: string; party: string; amount: string; at: Date };
      type Kind = 'receipt' | 'payment' | 'transfer_in' | 'transfer_out';
      const transferRows = transfers.map((t) => {
        const incoming = t.toAccountId === accountId;
        return {
          raw: {
            id: t.id,
            ref: 'Transfer',
            party: incoming ? `from ${t.fromName}` : `to ${t.toName}`,
            amount: t.amount,
            // transferredOn is a date; anchor it to midnight UTC for ordering.
            at: new Date(`${t.at}T00:00:00Z`),
          } satisfies Raw,
          kind: (incoming ? 'transfer_in' : 'transfer_out') as Kind,
        };
      });
      const merged: Array<{ raw: Raw; kind: Kind }> = [
        ...receipts.map((r) => ({ raw: r, kind: 'receipt' as const })),
        ...payments.map((p) => ({ raw: p, kind: 'payment' as const })),
        ...transferRows,
      ];
      // Oldest first so the running balance builds off the opening balance.
      merged.sort((a, b) => a.raw.at.getTime() - b.raw.at.getTime());

      const isCredit = (k: Kind) => k === 'receipt' || k === 'transfer_in';
      let running = paise(account.openingBalance);
      const chronological: AccountMovement[] = merged.map(({ raw, kind }) => {
        running += isCredit(kind) ? paise(raw.amount) : -paise(raw.amount);
        return {
          id: raw.id,
          kind,
          ref: raw.ref,
          party: raw.party,
          amount: Number(raw.amount).toFixed(2),
          at: raw.at,
          balance: money(running),
        };
      });
      // Present newest first for the passbook view.
      chronological.reverse();

      return ok({ account: toSummary(account), currency, movements: chronological });
    },

    async createAccount(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'accounts:write');
      if (!auth.ok) return auth;
      const parsed = accountSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.create(ctx, parsed.data);
      return ok({ id });
    },

    async updateAccount(
      ctx: TenantContext,
      accountId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'accounts:write');
      if (!auth.ok) return auth;
      const parsed = accountSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.update(ctx, accountId, parsed.data);
      if (!id) return err(notFound('Account'));
      return ok({ id });
    },

    async setAccountActive(
      ctx: TenantContext,
      accountId: string,
      isActive: boolean,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'accounts:write');
      if (!auth.ok) return auth;
      const id = await repo.setActive(ctx, accountId, isActive);
      if (!id) return err(notFound('Account'));
      return ok(null);
    },

    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'accounts:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportRows(ctx);
      const header = ['Account', 'Type', 'Opening', 'Received', 'Paid', 'Balance', 'Status'].join(
        ',',
      );
      const lines = rows.map((r) => {
        const a = toSummary(r);
        return [
          csvField(a.name),
          csvField(a.type),
          csvField(a.openingBalance),
          csvField(a.received),
          csvField(a.paid),
          csvField(a.balance),
          csvField(a.isActive ? 'active' : 'archived'),
        ].join(',');
      });
      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
