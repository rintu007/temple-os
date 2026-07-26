import type { Db } from '@templeos/db';
import { authorize, ok, type Result, type TenantContext } from '../../shared';
import { csvField } from '../reports/report.service';
import { createStatementRepository } from './statement.repository';
import type {
  IncomeExpenditureStatement,
  ReceiptsAndPaymentsStatement,
  StatementLine,
} from './statement.types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const paise = (v: string) => Math.round(Number(v) * 100);
const sumMinor = (lines: StatementLine[]) => lines.reduce((acc, l) => acc + paise(l.total), 0);
const fromMinor = (minor: number) => (minor / 100).toFixed(2);

/**
 * Financial-year range for a start year. India (and this product's default)
 * runs April–March, so FY 2026 is 2026-04-01 … 2027-03-31.
 */
export function financialYearRange(startYear: number): { from: string; to: string; label: string } {
  return {
    from: `${startYear}-04-01`,
    to: `${startYear + 1}-03-31`,
    label: `${startYear}–${startYear + 1}`,
  };
}

/** The FY start year that the given date falls into. */
export function financialYearOf(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

export function createStatementService({ db }: { db: Db }) {
  const repo = createStatementRepository(db);

  async function build(
    ctx: TenantContext,
    range: { from: string; to: string },
  ): Promise<IncomeExpenditureStatement> {
    const from = DATE.test(range.from) ? range.from : null;
    const to = DATE.test(range.to) ? range.to : null;
    const { currency, income, expenditure } = await repo.incomeAndExpenditure(ctx, from, to);
    const incomeMinor = sumMinor(income);
    const expenditureMinor = sumMinor(expenditure);
    return {
      currency,
      from: range.from,
      to: range.to,
      income,
      expenditure,
      incomeTotal: fromMinor(incomeMinor),
      expenditureTotal: fromMinor(expenditureMinor),
      net: fromMinor(incomeMinor - expenditureMinor),
    };
  }

  async function buildReceiptsAndPayments(
    ctx: TenantContext,
    range: { from: string; to: string },
  ): Promise<ReceiptsAndPaymentsStatement> {
    const from = DATE.test(range.from) ? range.from : null;
    const to = DATE.test(range.to) ? range.to : null;
    const [{ currency, income, expenditure }, cash] = await Promise.all([
      repo.incomeAndExpenditure(ctx, from, to),
      repo.cashPosition(ctx, from),
    ]);
    const opening =
      paise(cash.openingBase) + paise(cash.priorReceipts) - paise(cash.priorPayments);
    const receiptsMinor = sumMinor(income);
    const paymentsMinor = sumMinor(expenditure);
    return {
      currency,
      from: range.from,
      to: range.to,
      openingBalance: fromMinor(opening),
      receipts: income,
      payments: expenditure,
      receiptsTotal: fromMinor(receiptsMinor),
      paymentsTotal: fromMinor(paymentsMinor),
      closingBalance: fromMinor(opening + receiptsMinor - paymentsMinor),
    };
  }

  return {
    async getStatement(
      ctx: TenantContext,
      range: { from: string; to: string },
    ): Promise<Result<IncomeExpenditureStatement>> {
      const auth = authorize(ctx, 'reports:read');
      if (!auth.ok) return auth;
      return ok(await build(ctx, range));
    },

    async getReceiptsAndPayments(
      ctx: TenantContext,
      range: { from: string; to: string },
    ): Promise<Result<ReceiptsAndPaymentsStatement>> {
      const auth = authorize(ctx, 'reports:read');
      if (!auth.ok) return auth;
      return ok(await buildReceiptsAndPayments(ctx, range));
    },

    async exportCsv(
      ctx: TenantContext,
      range: { from: string; to: string },
    ): Promise<Result<string>> {
      const auth = authorize(ctx, 'reports:read');
      if (!auth.ok) return auth;
      const s = await build(ctx, range);

      const rows: string[] = [
        `Income & Expenditure Statement,${csvField(s.from)} to ${csvField(s.to)}`,
        '',
        'Section,Category,Amount',
      ];
      for (const l of s.income) rows.push(['Income', csvField(l.label), csvField(l.total)].join(','));
      rows.push(['Income', 'Total', csvField(s.incomeTotal)].join(','));
      rows.push('');
      for (const l of s.expenditure) {
        rows.push(['Expenditure', csvField(l.label), csvField(l.total)].join(','));
      }
      rows.push(['Expenditure', 'Total', csvField(s.expenditureTotal)].join(','));
      rows.push('');
      rows.push(['Net', s.net.startsWith('-') ? 'Deficit' : 'Surplus', csvField(s.net)].join(','));

      return ok(rows.join('\r\n') + '\r\n');
    },

    async exportReceiptsAndPaymentsCsv(
      ctx: TenantContext,
      range: { from: string; to: string },
    ): Promise<Result<string>> {
      const auth = authorize(ctx, 'reports:read');
      if (!auth.ok) return auth;
      const s = await buildReceiptsAndPayments(ctx, range);

      const rows: string[] = [
        `Receipts & Payments Account,${csvField(s.from)} to ${csvField(s.to)}`,
        '',
        'Section,Particulars,Amount',
        ['Receipts', 'Opening balance (cash & bank)', csvField(s.openingBalance)].join(','),
      ];
      for (const l of s.receipts) {
        rows.push(['Receipts', csvField(l.label), csvField(l.total)].join(','));
      }
      rows.push(['Receipts', 'Total', csvField(s.receiptsTotal)].join(','));
      rows.push('');
      for (const l of s.payments) {
        rows.push(['Payments', csvField(l.label), csvField(l.total)].join(','));
      }
      rows.push(['Payments', 'Closing balance (cash & bank)', csvField(s.closingBalance)].join(','));
      rows.push(['Payments', 'Total', csvField(s.paymentsTotal)].join(','));

      return ok(rows.join('\r\n') + '\r\n');
    },
  };
}

export type StatementService = ReturnType<typeof createStatementService>;
