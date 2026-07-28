import type { Db } from '@templeos/db';
import { postSchema } from '@templeos/validators';
import { authorize, domainError, err, notFound, ok, type Result, type TenantContext } from '../../shared';
import { createPostRepository } from './post.repository';
import type { PostDetail, PostSummary } from './post.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

function toSummary(row: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  authorName: string | null;
  status: 'draft' | 'published';
  publishedAt: Date | null;
  createdAt: Date;
}): PostSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    coverImageUrl: row.coverImageUrl,
    authorName: row.authorName,
    status: row.status,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
  };
}

function toDetail(row: Parameters<typeof toSummary>[0] & { body: string }): PostDetail {
  return { ...toSummary(row), body: row.body };
}

export function createPostService({ db }: { db: Db }) {
  const repo = createPostRepository(db);

  return {
    async listPosts(ctx: TenantContext): Promise<Result<PostSummary[]>> {
      const auth = authorize(ctx, 'website:read');
      if (!auth.ok) return auth;
      const rows = await repo.list(ctx);
      return ok(rows.map(toSummary));
    },

    async getPost(ctx: TenantContext, postId: string): Promise<Result<PostDetail>> {
      const auth = authorize(ctx, 'website:read');
      if (!auth.ok) return auth;
      const row = await repo.findById(ctx, postId);
      if (!row) return err(notFound('Post'));
      return ok(toDetail(row));
    },

    async createPost(ctx: TenantContext, rawInput: unknown): Promise<Result<PostDetail>> {
      const auth = authorize(ctx, 'website:write');
      if (!auth.ok) return auth;
      const parsed = postSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const row = await repo.create(ctx, parsed.data);
      return ok(toDetail(row));
    },

    async updatePost(
      ctx: TenantContext,
      postId: string,
      rawInput: unknown,
    ): Promise<Result<PostDetail>> {
      const auth = authorize(ctx, 'website:write');
      if (!auth.ok) return auth;
      const parsed = postSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const row = await repo.update(ctx, postId, parsed.data);
      if (!row) return err(notFound('Post'));
      return ok(toDetail(row));
    },

    async setPostStatus(
      ctx: TenantContext,
      postId: string,
      status: 'draft' | 'published',
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'website:write');
      if (!auth.ok) return auth;
      const updated = await repo.setStatus(ctx, postId, status);
      if (!updated) return err(notFound('Post'));
      return ok(null);
    },

    async deletePost(ctx: TenantContext, postId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'website:write');
      if (!auth.ok) return auth;
      const deleted = await repo.deletePost(ctx, postId);
      if (!deleted) return err(notFound('Post'));
      return ok(null);
    },

    /** Public site — latest published posts. */
    async listPublicPosts(organizationId: string, limit = 12): Promise<PostSummary[]> {
      const rows = await repo.listPublished(organizationId, limit);
      return rows.map(toSummary);
    },

    /** Public site — one published post by its permalink slug. */
    async getPublicPost(organizationId: string, slug: string): Promise<PostDetail | null> {
      const row = await repo.findPublishedBySlug(organizationId, slug);
      return row ? toDetail(row) : null;
    },
  };
}

export type PostService = ReturnType<typeof createPostService>;
