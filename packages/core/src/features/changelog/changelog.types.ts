export interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
  publishedAt: Date;
}

export interface ChangelogFeed {
  items: (ChangelogEntry & { unread: boolean })[];
  unreadCount: number;
}
