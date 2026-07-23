import type { Db } from '@templeos/db';
import {
  announcementSchema,
  contactMessageSchema,
  siteSettingsSchema,
} from '@templeos/validators';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { createWebsiteRepository } from './website.repository';
import {
  EMPTY_SITE_SETTINGS,
  type AnnouncementSummary,
  type ContactMessagePage,
  type ContactMessageSummary,
  type SiteSettings,
} from './website.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

function toSettings(row: {
  tagline: string | null;
  aboutText: string | null;
  historyText: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressText: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
}): SiteSettings {
  return {
    tagline: row.tagline,
    aboutText: row.aboutText,
    historyText: row.historyText,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    addressText: row.addressText,
    facebookUrl: row.facebookUrl,
    instagramUrl: row.instagramUrl,
    youtubeUrl: row.youtubeUrl,
  };
}

function toAnnouncement(row: {
  id: string;
  title: string;
  body: string | null;
  status: 'draft' | 'published';
  publishedAt: Date | null;
  createdAt: Date;
}): AnnouncementSummary {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
  };
}

export function createWebsiteService({ db }: { db: Db }) {
  const repo = createWebsiteRepository(db);

  return {
    /** Admin editor read — empty defaults when never saved. */
    async getSettings(ctx: TenantContext): Promise<Result<SiteSettings>> {
      const auth = authorize(ctx, 'website:read');
      if (!auth.ok) return auth;
      const row = await repo.getSettings(ctx.organizationId);
      return ok(row ? toSettings(row) : EMPTY_SITE_SETTINGS);
    },

    async updateSettings(ctx: TenantContext, rawInput: unknown): Promise<Result<SiteSettings>> {
      const auth = authorize(ctx, 'website:write');
      if (!auth.ok) return auth;
      const parsed = siteSettingsSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const row = await repo.upsertSettings(ctx, parsed.data);
      return ok(toSettings(row));
    },

    /** Public pages — no auth, org resolved server-side from the hostname. */
    async getPublicContent(organizationId: string): Promise<SiteSettings> {
      const row = await repo.getSettings(organizationId);
      return row ? toSettings(row) : EMPTY_SITE_SETTINGS;
    },

    /** Public contact form. Returns the temple's notification email, if set. */
    async submitContactMessage(
      organizationId: string,
      rawInput: unknown,
    ): Promise<Result<{ notifyEmail: string | null; senderName: string; message: string }>> {
      const parsed = contactMessageSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));

      const message = await repo.insertMessage(organizationId, parsed.data);
      const settings = await repo.getSettings(organizationId);
      return ok({
        notifyEmail: settings?.contactEmail ?? null,
        senderName: message.name,
        message: message.message,
      });
    },

    async listMessages(ctx: TenantContext, rawQuery: unknown): Promise<Result<ContactMessagePage>> {
      const auth = authorize(ctx, 'website:read');
      if (!auth.ok) return auth;
      const q = (rawQuery ?? {}) as { page?: number; pageSize?: number };
      const page = Math.max(1, Number(q.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25));

      const { items, total, newCount } = await repo.listMessages(ctx, { page, pageSize });
      const summaries: ContactMessageSummary[] = items.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        message: m.message,
        status: m.status,
        createdAt: m.createdAt,
      }));
      return ok({ items: summaries, total, newCount, page, pageSize });
    },

    async markMessageRead(ctx: TenantContext, messageId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'website:write');
      if (!auth.ok) return auth;
      const updated = await repo.markMessageRead(ctx, messageId);
      if (!updated) return err(notFound('Message'));
      return ok(null);
    },

    // ---- Announcements ----
    async listAnnouncements(ctx: TenantContext): Promise<Result<AnnouncementSummary[]>> {
      const auth = authorize(ctx, 'website:read');
      if (!auth.ok) return auth;
      const rows = await repo.listAnnouncements(ctx);
      return ok(rows.map(toAnnouncement));
    },

    async createAnnouncement(
      ctx: TenantContext,
      rawInput: unknown,
    ): Promise<Result<AnnouncementSummary>> {
      const auth = authorize(ctx, 'website:write');
      if (!auth.ok) return auth;
      const parsed = announcementSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const row = await repo.createAnnouncement(ctx, parsed.data);
      return ok(toAnnouncement(row));
    },

    async setAnnouncementStatus(
      ctx: TenantContext,
      announcementId: string,
      status: 'draft' | 'published',
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'website:write');
      if (!auth.ok) return auth;
      const updated = await repo.setAnnouncementStatus(ctx, announcementId, status);
      if (!updated) return err(notFound('Announcement'));
      return ok(null);
    },

    async deleteAnnouncement(ctx: TenantContext, announcementId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'website:write');
      if (!auth.ok) return auth;
      const deleted = await repo.deleteAnnouncement(ctx, announcementId);
      if (!deleted) return err(notFound('Announcement'));
      return ok(null);
    },

    /** Public site — latest published notices. */
    async listPublicAnnouncements(
      organizationId: string,
      limit = 3,
    ): Promise<AnnouncementSummary[]> {
      const rows = await repo.listPublicAnnouncements(organizationId, limit);
      return rows.map(toAnnouncement);
    },
  };
}

export type WebsiteService = ReturnType<typeof createWebsiteService>;
