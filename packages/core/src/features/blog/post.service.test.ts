import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { auditLogs, createDb, domains, memberships, organizations, posts, roles, users } from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createPostService } from './post.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('blog: posts with permalinks + publish gating (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const post$ = createPostService({ db });

  const run = `pst${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let postId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(posts).where(inArray(posts.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up an organization', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('blog test'),
      { name: 'Blog Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };
  });

  it('creates a draft with a derived slug that stays off the public site', async () => {
    const created = await post$.createPost(ctx, {
      title: 'Diwali Celebrations 2026!',
      body: 'Join us for the annual Diwali celebrations with lighting and prasadam.',
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      postId = created.value.id;
      expect(created.value.slug).toBe('diwali-celebrations-2026');
      expect(created.value.status).toBe('draft');
    }

    const publicList = await post$.listPublicPosts(orgId);
    expect(publicList).toHaveLength(0);
  });

  it('dedupes a colliding slug by appending a suffix', async () => {
    const dup = await post$.createPost(ctx, {
      title: 'Diwali Celebrations 2026',
      body: 'A second post that happens to slugify to the same permalink as the first.',
    });
    expect(dup.ok).toBe(true);
    if (dup.ok) expect(dup.value.slug).toBe('diwali-celebrations-2026-2');
  });

  it('publishing puts it on the public site, reachable by slug', async () => {
    const published = await post$.setPostStatus(ctx, postId, 'published');
    expect(published.ok).toBe(true);

    const publicList = await post$.listPublicPosts(orgId);
    expect(publicList).toHaveLength(1);
    expect(publicList[0]?.title).toBe('Diwali Celebrations 2026!');
    expect(publicList[0]?.publishedAt).toBeInstanceOf(Date);

    const bySlug = await post$.getPublicPost(orgId, 'diwali-celebrations-2026');
    expect(bySlug?.id).toBe(postId);

    // The still-draft duplicate is not publicly reachable.
    const stillDraft = await post$.getPublicPost(orgId, 'diwali-celebrations-2026-2');
    expect(stillDraft).toBeNull();
  });

  it('a viewer can read the admin list but cannot write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const list = await post$.listPosts(viewer);
    expect(list.ok).toBe(true);
    const write = await post$.createPost(viewer, { title: 'Nope', body: 'Not allowed at all.' });
    expect(write.ok).toBe(false);
  });

  it('validation rejects a too-short title', async () => {
    const bad = await post$.createPost(ctx, { title: 'Hi', body: 'Too short a title above.' });
    expect(bad.ok).toBe(false);
  });

  it('unpublishing hides it; deleting removes it', async () => {
    const unpublished = await post$.setPostStatus(ctx, postId, 'draft');
    expect(unpublished.ok).toBe(true);
    expect(await post$.listPublicPosts(orgId)).toHaveLength(0);

    const deleted = await post$.deletePost(ctx, postId);
    expect(deleted.ok).toBe(true);
    const list = await post$.listPosts(ctx);
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.value.find((p) => p.id === postId)).toBeUndefined();
  });
});
