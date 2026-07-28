import { and, desc, eq, like, ne } from 'drizzle-orm';
import { auditLogs, newId, posts, withTenantContext, type Db, type Tx } from '@templeos/db';
import { slugify, type PostInput } from '@templeos/validators';
import type { TenantContext } from '../../shared';

/** Appends '-2', '-3'... until the slug is free within the org. */
async function uniqueSlug(
  tx: Tx,
  organizationId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const rows = await tx
    .select({ slug: posts.slug })
    .from(posts)
    .where(
      and(
        eq(posts.organizationId, organizationId),
        like(posts.slug, `${base}%`),
        excludeId ? ne(posts.id, excludeId) : undefined,
      ),
    );
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function createPostRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  return {
    async list(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select()
          .from(posts)
          .where(eq(posts.organizationId, ctx.organizationId))
          .orderBy(desc(posts.createdAt)),
      );
    },

    async findById(ctx: TenantContext, postId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx.select().from(posts).where(eq(posts.id, postId)).limit(1);
        return row ?? null;
      });
    },

    async create(ctx: TenantContext, input: PostInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const slug = await uniqueSlug(tx, ctx.organizationId, input.slug ?? slugify(input.title));
        const [row] = await tx
          .insert(posts)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            title: input.title,
            slug,
            excerpt: input.excerpt ?? null,
            body: input.body,
            coverImageUrl: input.coverImageUrl ?? null,
            authorName: input.authorName ?? null,
          })
          .returning();
        if (!row) throw new Error('post insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'post.created',
          entityType: 'post',
          entityId: row.id,
          after: { title: row.title, slug: row.slug },
        });
        return row;
      });
    },

    async update(ctx: TenantContext, postId: string, input: PostInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const slug = await uniqueSlug(
          tx,
          ctx.organizationId,
          input.slug ?? slugify(input.title),
          postId,
        );
        const [updated] = await tx
          .update(posts)
          .set({
            title: input.title,
            slug,
            excerpt: input.excerpt ?? null,
            body: input.body,
            coverImageUrl: input.coverImageUrl ?? null,
            authorName: input.authorName ?? null,
          })
          .where(eq(posts.id, postId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'post.updated',
          entityType: 'post',
          entityId: postId,
          after: { title: updated.title, slug: updated.slug },
        });
        return updated;
      });
    },

    async setStatus(ctx: TenantContext, postId: string, status: 'draft' | 'published') {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(posts)
          .set({ status, publishedAt: status === 'published' ? new Date() : null })
          .where(eq(posts.id, postId))
          .returning();
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: status === 'published' ? 'post.published' : 'post.unpublished',
          entityType: 'post',
          entityId: postId,
        });
        return updated;
      });
    },

    async deletePost(ctx: TenantContext, postId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [deleted] = await tx
          .delete(posts)
          .where(eq(posts.id, postId))
          .returning({ id: posts.id, title: posts.title });
        if (!deleted) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'post.deleted',
          entityType: 'post',
          entityId: postId,
          after: { title: deleted.title },
        });
        return deleted;
      });
    },

    /** Public site: latest published posts, newest first. */
    async listPublished(organizationId: string, limit: number) {
      return withTenantContext(db, { organizationId }, (tx) =>
        tx
          .select()
          .from(posts)
          .where(and(eq(posts.organizationId, organizationId), eq(posts.status, 'published')))
          .orderBy(desc(posts.publishedAt))
          .limit(limit),
      );
    },

    /** Public site: one published post by its permalink slug. */
    async findPublishedBySlug(organizationId: string, slug: string) {
      return withTenantContext(db, { organizationId }, async (tx) => {
        const [row] = await tx
          .select()
          .from(posts)
          .where(
            and(
              eq(posts.organizationId, organizationId),
              eq(posts.slug, slug),
              eq(posts.status, 'published'),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },
  };
}

export type PostRepository = ReturnType<typeof createPostRepository>;
