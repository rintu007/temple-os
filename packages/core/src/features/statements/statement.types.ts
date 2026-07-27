export interface StatementLine {
  label: string;
  total: string;
}

export interface IncomeExpenditureStatement {
  currency: 'INR' | 'BDT';
  from: string;
  to: string;
  income: StatementLine[];
  expenditure: StatementLine[];
  incomeTotal: string;
  expenditureTotal: string;
  /** incomeTotal − expenditureTotal; negative means a deficit. */
  net: string;
}

/**
 * Cash-basis Receipts & Payments account. Unlike the I&E statement, it opens
 * and closes on the cash & bank balance, so the two sides tie out:
 * openingBalance + receiptsTotal = paymentsTotal + closingBalance.
 */
export interface ReceiptsAndPaymentsStatement {
  currency: 'INR' | 'BDT';
  from: string;
  to: string;
  openingBalance: string;
  receipts: StatementLine[];
  payments: StatementLine[];
  receiptsTotal: string;
  paymentsTotal: string;
  closingBalance: string;
}

/**
 * A derived Statement of Financial Position (balance sheet) as on a date. Every
 * figure ties to the ledger; the general fund is the balancing figure so the
 * two sides always agree: assetsTotal = liabilitiesTotal + fundsTotal.
 */
export interface BalanceSheet {
  currency: 'INR' | 'BDT';
  asOf: string;
  assets: StatementLine[];
  assetsTotal: string;
  liabilities: StatementLine[];
  liabilitiesTotal: string;
  funds: StatementLine[];
  fundsTotal: string;
  /**
   * Memorandum items — loan receivables/payables and investments held. Tracked
   * in their own registers and disclosed here for governance, but not summed
   * into the totals above (they are not yet posted through the cash ledger, so
   * including them would double-count against cash). Empty when there are none.
   */
  memorandum: StatementLine[];
}
