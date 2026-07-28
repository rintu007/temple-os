export interface NotificationItem {
  id: string;
  action: string;
  title: string;
  entityType: string;
  entityId: string | null;
  /** Name of the member who performed the action; null for system actions. */
  actorName: string | null;
  createdAt: Date;
  unread: boolean;
}

export interface NotificationFeed {
  items: NotificationItem[];
  unreadCount: number;
}
