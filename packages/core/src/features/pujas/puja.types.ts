export interface PujaTypeSummary {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  isActive: boolean;
}

/** Public catalog entry shown on the tenant site. */
export interface PublicPujaType {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
}

export interface PujaBookingSummary {
  id: string;
  pujaName: string;
  devoteeName: string;
  email: string | null;
  phone: string | null;
  amount: string;
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  preferredDate: string | null;
  note: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: Date;
  priestId: string | null;
  priestName: string | null;
  scheduledOn: string | null;
  scheduledTime: string | null;
}

export interface PriestSummary {
  id: string;
  name: string;
  phone: string | null;
  specialty: string | null;
  isActive: boolean;
}

/** A standing weekly duty-roster line — priest × ritual × days of week. */
export interface DutyRosterEntry {
  id: string;
  priestId: string;
  priestName: string;
  dailyScheduleId: string;
  scheduleTitle: string;
  startTime: string;
  endTime: string | null;
  templeName: string | null;
  /** 0=Sunday..6=Saturday; empty = every day. */
  daysOfWeek: number[];
  notes: string | null;
  isActive: boolean;
}

/** Today's roster resolved to actual priests, with a leave flag for planning substitutes. */
export interface TodaysDutyEntry {
  id: string;
  priestId: string;
  priestName: string;
  scheduleTitle: string;
  startTime: string;
  endTime: string | null;
  templeName: string | null;
  onLeave: boolean;
}

export interface PriestLeaveSummary {
  id: string;
  priestId: string;
  priestName: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface PujaBookingPage {
  items: PujaBookingSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BookingOrder {
  orderId: string;
  amountPaise: number;
  currency: 'INR';
  keyId: string;
  pujaName: string;
}

export interface ConfirmedBooking {
  receiptNumber: string;
  pujaName: string;
  amount: string;
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  devoteeName: string;
  /** True when another path (client confirm or webhook) already recorded it. */
  alreadyPaid: boolean;
}
