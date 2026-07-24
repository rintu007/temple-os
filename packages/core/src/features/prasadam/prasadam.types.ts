export type PrasadamMeal = 'breakfast' | 'lunch' | 'dinner' | 'prasadam';

export interface PrasadamSessionSummary {
  id: string;
  servedOn: string;
  meal: PrasadamMeal;
  servedCount: number;
  sponsorName: string | null;
  /** Receipt of the sponsorship donation, when one was recorded. */
  sponsorReceiptNumber: string | null;
  sponsorAmount: string | null;
  currency: 'INR' | 'BDT' | null;
  note: string | null;
  createdAt: Date;
}

export interface PrasadamStats {
  todayMeals: number;
  monthMeals: number;
  monthSessions: number;
}
