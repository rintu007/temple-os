import { index, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { organizations } from './tenancy';

/**
 * Public-website content, one row per organization (upserted). Free-text
 * fields are plain text rendered with paragraph breaks — the block-based CMS
 * arrives in a later phase.
 */
export const siteSettings = pgTable('site_settings', {
  organizationId: uuid()
    .primaryKey()
    .references(() => organizations.id),
  tagline: text(),
  aboutText: text(),
  historyText: text(),
  contactEmail: text(),
  contactPhone: text(),
  addressText: text(),
  facebookUrl: text(),
  instagramUrl: text(),
  youtubeUrl: text(),
  ...timestamps,
});

/** Gallery images; the binary lives in Supabase Storage at storagePath. */
export const galleryImages = pgTable(
  'gallery_images',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    storagePath: text().notNull(),
    caption: text(),
    ...timestamps,
  },
  (t) => [index('gallery_images_org_idx').on(t.organizationId)],
);

export const contactMessageStatusEnum = pgEnum('contact_message_status', ['new', 'read']);

/** Messages submitted through the public contact form. */
export const contactMessages = pgTable(
  'contact_messages',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    name: text().notNull(),
    email: text(),
    phone: text(),
    message: text().notNull(),
    status: contactMessageStatusEnum().notNull().default('new'),
    ...timestamps,
  },
  (t) => [index('contact_messages_org_status_idx').on(t.organizationId, t.status)],
);
