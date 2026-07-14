export interface DevoteeSummary {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  gender: 'male' | 'female' | 'other' | null;
  dateOfBirth: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  notes: string | null;
  status: 'active' | 'archived';
  familyId: string | null;
  familyName: string | null;
}

export interface DevoteePage {
  items: DevoteeSummary[];
  total: number;
  page: number;
  pageSize: number;
}
