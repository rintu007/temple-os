export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  /** Name of the member who performed the action; null for system actions. */
  actorName: string | null;
  createdAt: Date;
}

export interface ActivityPage {
  items: ActivityEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActivityFilters {
  entityType: string | null;
  /** Inclusive 'YYYY-MM-DD' bounds. */
  from: string | null;
  to: string | null;
}
