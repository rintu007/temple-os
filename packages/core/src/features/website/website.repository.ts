import { and, count, desc, eq } from 'drizzle-orm';
import {
  auditLogs,
  contactMessages,
  newId,
  siteSettings,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { ContactMessageInput, SiteSettingsInput } from '@templeos/validators';
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
  };
}

export type WebsiteRepository = ReturnType<typeof createWebsiteRepository>;
