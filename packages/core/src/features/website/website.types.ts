export interface SiteSettings {
  tagline: string | null;
  aboutText: string | null;
  historyText: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressText: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
}

export const EMPTY_SITE_SETTINGS: SiteSettings = {
  tagline: null,
  aboutText: null,
  historyText: null,
  contactEmail: null,
  contactPhone: null,
  addressText: null,
  facebookUrl: null,
  instagramUrl: null,
  youtubeUrl: null,
};

export interface ContactMessageSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  status: 'new' | 'read';
  createdAt: Date;
}

export interface ContactMessagePage {
  items: ContactMessageSummary[];
  total: number;
  newCount: number;
  page: number;
  pageSize: number;
}

export interface AnnouncementSummary {
  id: string;
  title: string;
  body: string | null;
  status: 'draft' | 'published';
  publishedAt: Date | null;
  createdAt: Date;
}
