import type { ExpenseMethod } from '@templeos/validators';

export interface ExpenseSummary {
  id: string;
  voucherNumber: string;
  paidTo: string;
  categoryName: string | null;
  amount: string;
  currency: 'INR' | 'BDT';
  method: ExpenseMethod;
  reference: string | null;
  note: string | null;
  spentAt: Date;
  status: 'recorded' | 'void';
  voidReason: string | null;
}

export interface ExpensePage {
  items: ExpenseSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExpenseStats {
  currency: 'INR' | 'BDT';
  allTimeTotal: string;
  monthTotal: string;
  monthCount: number;
}
