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
