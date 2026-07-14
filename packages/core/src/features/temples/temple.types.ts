export interface TempleSummary {
  id: string;
  name: string;
  slug: string;
  deity: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
}

export interface ScheduleItem {
  id: string;
  templeId: string;
  title: string;
  /** 'HH:MM:SS' as returned by Postgres time columns */
  startTime: string;
  endTime: string | null;
  description: string | null;
}

/** What the public tenant site renders. */
export interface PublicTemple {
  id: string;
  name: string;
  deity: string | null;
  city: string | null;
  schedule: Array<Pick<ScheduleItem, 'id' | 'title' | 'startTime' | 'endTime' | 'description'>>;
}
