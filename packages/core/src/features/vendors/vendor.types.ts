import type { BillPaymentMethod } from '@templeos/validators';

export interface VendorSummary {
  id: string;
  name: string;
  category: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  note: string | null;
  isActive: boolean;
  /** Outstanding balance summed across this vendor's open bills, org currency. */
  outstanding: string;
  openBillCount: number;
}

export type BillPaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface BillSummary {
  id: string;
  vendorId: string;
  billNumber: string;
  description: string | null;
  amount: string;
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  billDate: string;
  dueDate: string | null;
  note: string | null;
  status: 'open' | 'void';
  voidReason: string | null;
  /** Derived — sum of recorded vouchers linked to this bill. */
  paid: string;
  outstanding: string;
  paymentStatus: BillPaymentStatus;
  isOverdue: boolean;
}

export interface VendorDetail {
  vendor: VendorSummary;
  bills: BillSummary[];
}

export interface PayablesStats {
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  totalOutstanding: string;
  overdueOutstanding: string;
  openBillCount: number;
  vendorCount: number;
}

export type { BillPaymentMethod };
