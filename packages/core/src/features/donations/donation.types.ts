import type { DonationMethod } from '@templeos/validators';

export interface DonationSummary {
  id: string;
  receiptNumber: string;
  donorName: string;
  devoteeId: string | null;
  devoteeName: string | null;
  categoryName: string | null;
  /** Decimal string, e.g. '501.00' — never a float */
  amount: string;
  currency: 'INR' | 'BDT';
  method: DonationMethod;
  reference: string | null;
  note: string | null;
  donatedAt: Date;
  status: 'recorded' | 'void';
  voidReason: string | null;
}

export interface DonationPage {
  items: DonationSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DonationStats {
  currency: 'INR' | 'BDT';
  monthTotal: string;
  monthCount: number;
  allTimeTotal: string;
}

/** A devotee's giving snapshot for their profile page. */
export interface DevoteeGiving {
  currency: 'INR' | 'BDT';
  lifetimeTotal: string;
  lifetimeCount: number;
  fyTotal: string;
  fyCount: number;
  /** e.g. '2026–2027' */
  fyLabel: string;
  /** Current financial-year start (April), for the statement link. */
  fyStartYear: number;
  recent: DonationSummary[];
}

/** A printable annual (financial-year) donation statement for one devotee. */
export interface DevoteeStatement {
  fyStartYear: number;
  fyLabel: string;
  currency: 'INR' | 'BDT';
  items: DonationSummary[];
  total: string;
  count: number;
}
