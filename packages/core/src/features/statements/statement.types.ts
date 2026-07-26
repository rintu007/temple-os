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
