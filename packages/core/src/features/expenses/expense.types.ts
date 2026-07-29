import type { ExpenseMethod } from '@templeos/validators';

export interface ExpenseSummary {
  id: string;
  voucherNumber: string;
  paidTo: string;
  categoryName: string | null;
  amount: string;
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  method: ExpenseMethod;
  reference: string | null;
  note: string | null;
  spentAt: Date;
  status: 'recorded' | 'void';
  voidReason: string | null;
  approvalStatus: 'not_required' | 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
}

export interface ExpenseApprovalSettings {
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  threshold: string | null;
}

export interface ExpensePage {
  items: ExpenseSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExpenseStats {
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  allTimeTotal: string;
  monthTotal: string;
  monthCount: number;
}
