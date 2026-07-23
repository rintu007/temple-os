import { and, count, desc, eq } from 'drizzle-orm';
import {
  announcements,
  auditLogs,
  contactMessages,
  newId,
  siteSettings,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type {
  AnnouncementInput,
  ContactMessageInput,
  SiteSettingsInput,
} from '@templeos/validators';
import type { TenantContext } from '../../shared';

function settingsValues(input: SiteSettingsInput) {
  return {
    tagline: input.tagline ?? null,
    aboutText: input.aboutText ?? null,
    historyText: input.historyText ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    addressText: input.addressText ?? null,
    facebookUrl: input.facebookUrl ?? null,
    instagramUrl: input.instagramUrl ?? null,
    youtubeUrl: input.youtubeUrl ?? null,
  };
}

export function createWebsiteRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async getSettings(organizationId: string) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [row] = await tx
          .select()
          .from(siteSettings)
          .where(eq(siteSettings.organizationId, organizationId))
          .limit(1);
        return row ?? null;
      });
    },

    async upsertSettings(ctx: TenantContext, input: SiteSettingsInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const values = settingsValues(input);
        const [row] = await tx
          .insert(siteSettings)
          .values({ organizationId: ctx.organizationId, ...values })
          .onConflictDoUpdate({ target: siteSettings.organizationId, set: values })
          .returning();
        if (!row) throw new Error('site settings upsert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'site_settings.updated',
          entityType: 'site_settings',
          entityId: ctx.organizationId,
        });
        return row;
      });
    },

    /** Public contact form insert — org-scoped, no signed-in user. */
    async insertMessage(organizationId: string, input: ContactMessageInput) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [message] = await tx
          .insert(contactMessages)
          .values({
            id: newId(),
            organizationId,
            name: input.name,
            email: input.email ?? null,
            phone: input.phone ?? null,
            message: input.message,
          })
          .returning();
        if (!message) throw new Error('contact message insert returned no row');
        return message;
      });
    },

    async listMessages(ctx: TenantContext, query: { page: number; pageSize: number }) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const where = eq(contactMessages.organizationId, ctx.organizationId);
        const [items, [totalRow], [newRow]] = await Promise.all([
          tx
            .select()
            .from(contactMessages)
            .where(where)
            .orderBy(desc(contactMessages.createdAt))
            .limit(query.pageSize)
            .offset((query.page - 1) * query.pageSize),
          tx.select({ value: count() }).from(contactMessages).where(where),
          tx
            .select({ value: count() })
            .from(contactMessages)
            .where(and(where, eq(contactMessages.status, 'new'))),
        ]);
        return {
          items,
          total: totalRow?.value ?? 0,
          newCount: newRow?.value ?? 0,
        };
      });
    },

    async markMessageRead(ctx: TenantContext, messageId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(contactMessages)
          .set({ status: 'read' })
          .where(eq(contactMessages.id, messageId))
          .returning();
        return updated ?? null;
      });
    },

    // ---- Announcements ----
    async createAnnouncement(ctx: TenantContext, input: AnnouncementInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(announcements)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            title: input.title,
            body: input.body ?? null,
          })
          .returning();
        if (!row) throw new Error('announcement insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'announcement.created',
          entityType: 'announcement',
          entityId: row.id,
          after: { title: row.title },
        });
        return row;
      });
    },

    async listAnnouncements(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select()
          .from(announcements)
          .where(eq(announcements.organizationId, ctx.organizationId))
          .orderBy(desc(announcements.createdAt)),
      );
    },

    async setAnnouncementStatus(
      ctx: TenantContext,
      announcementId: string,
      status: 'draft' | 'published',
    ) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(announcements)
          .set({ status, publishedAt: status === 'published' ? new Date() : null })
          .where(eq(announcements.id, announcementId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: status === 'published' ? 'announcement.published' : 'announcement.unpublished',
          entityType: 'announcement',
          entityId: announcementId,
        });
        return updated;
      });
    },

    async deleteAnnouncement(ctx: TenantContext, announcementId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [deleted] = await tx
          .delete(announcements)
          .where(eq(announcements.id, announcementId))
          .returning({ id: announcements.id, title: announcements.title });
        if (!deleted) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'announcement.deleted',
          entityType: 'announcement',
          entityId: announcementId,
          after: { title: deleted.title },
        });
        return deleted;
      });
    },

    /** Public site: latest published notices, newest first. */
    async listPublicAnnouncements(organizationId: string, limit: number) {
      return withTenantContext(db, { organizationId }, (tx) =>
        tx
          .select()
          .from(announcements)
          .where(
            and(
              eq(announcements.organizationId, organizationId),
              eq(announcements.status, 'published'),
            ),
          )
          .orderBy(desc(announcements.publishedAt))
          .limit(limit),
      );
    },
  };
}

export type WebsiteRepository = ReturnType<typeof createWebsiteRepository>;
