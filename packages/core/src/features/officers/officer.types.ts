export interface OfficeBearerSummary {
  id: string;
  name: string;
  designation: string;
  body: string | null;
  phone: string | null;
  email: string | null;
  termStartsOn: string | null;
  termEndsOn: string | null;
  isActive: boolean;
  note: string | null;
  createdAt: Date;
}
