export interface PujaTypeSummary {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: 'INR' | 'BDT';
  isActive: boolean;
}

/** Public catalog entry shown on the tenant site. */
export interface PublicPujaType {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: 'INR' | 'BDT';
}

export interface PujaBookingSummary {
  id: string;
  pujaName: string;
  devoteeName: string;
  email: string | null;
  phone: string | null;
  amount: string;
  currency: 'INR' | 'BDT';
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
  currency: 'INR' | 'BDT';
  devoteeName: string;
  /** True when another path (client confirm or webhook) already recorded it. */
  alreadyPaid: boolean;
}
