export interface EventSummary {
  id: string;
  kind: 'event' | 'festival';
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  isPublished: boolean;
}

export interface EventPage {
  items: EventSummary[];
  total: number;
  page: number;
  pageSize: number;
}

/** What the public tenant site renders — published events only. */
export type PublicEvent = Omit<EventSummary, 'isPublished'>;
