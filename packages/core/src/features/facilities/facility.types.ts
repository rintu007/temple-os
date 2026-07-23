export interface FacilitySummary {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  rentAmount: string;
  currency: 'INR' | 'BDT';
  isActive: boolean;
}

export interface FacilityBookingSummary {
  id: string;
  facilityId: string;
  facilityName: string;
  bookerName: string;
  phone: string | null;
  email: string | null;
  eventDate: string;
  purpose: string | null;
  amount: string;
  currency: 'INR' | 'BDT';
  status: 'requested' | 'confirmed' | 'cancelled';
  note: string | null;
  createdAt: Date;
}

/** Public-site card. */
export interface PublicFacility {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  rentAmount: string;
  currency: 'INR' | 'BDT';
}
