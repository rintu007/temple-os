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

export interface ImportRowError {
  /** 1-based line number in the uploaded file. */
  line: number;
  message: string;
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  errors: ImportRowError[];
}
