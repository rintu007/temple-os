export type Currency = 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';

export type ReminderKind =
  | 'pledge'
  | 'vendor_bill'
  | 'loan'
  | 'investment'
  | 'membership'
  | 'recurring_expense'
  | 'recurring_donation';

export interface ReminderItem {
  kind: ReminderKind;
  /** The record id, for linking through to its detail page. */
  id: string;
  title: string;
  subtitle: string | null;
  /** ISO date ('YYYY-MM-DD') the item is due / matures / expires. */
  dueDate: string;
  /** Relevant amount — outstanding, maturity value, or renewal amount. */
  amount: string;
  /** True when the due date has already passed. */
  overdue: boolean;
}

export interface NamedTotal {
  label: string;
  total: string;
}

export interface Insights {
  currency: Currency;
  /** Financial-year label the analytics cover, e.g. 'FY 2026–27'. */
  financialYear: string;
  /** Date-based items needing attention, soonest (and overdue) first. */
  reminders: ReminderItem[];
  /** Counts by reminder kind, for the summary tiles. */
  reminderCounts: { total: number; overdue: number };
  income: string;
  expenditure: string;
  net: string;
  topDonors: NamedTotal[];
  givingByCategory: NamedTotal[];
  topExpenseCategories: NamedTotal[];
}
