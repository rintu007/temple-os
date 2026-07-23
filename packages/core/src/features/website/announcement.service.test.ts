import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  announcements,
  auditLogs,
  createDb,
  domains,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createWebsiteService } from './website.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('announcements: drafts, publish gating, public list (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createWebsiteService({ db });

  const run = `ann${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let announcementId = '';

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(announcements).where(inArray(announcements.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up an organization', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('announcement test'),
      { name: 'Announce Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };
  });

  it('creates a draft that stays off the public site', async () => {
    const created = await service.createAnnouncement(ctx, {
      title: 'Special darshan timings this Ekadashi',
      body: 'Mangal aarti at 4:30 AM.',
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      announcementId = created.value.id;
      expect(created.value.status).toBe('draft');
    }

    const publicList = await service.listPublicAnnouncements(orgId);
    expect(publicList).toHaveLength(0);
  });

  it('publishing puts it on the public site with a timestamp', async () => {
    const published = await service.setAnnouncementStatus(ctx, announcementId, 'published');
    expect(published.ok).toBe(true);

    const publicList = await service.listPublicAnnouncements(orgId);
    expect(publicList).toHaveLength(1);
    expect(publicList[0]?.title).toBe('Special darshan timings this Ekadashi');
    expect(publicList[0]?.publishedAt).toBeInstanceOf(Date);
  });

  it('viewer can read the admin list but cannot write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const list = await service.listAnnouncements(viewer);
    expect(list.ok).toBe(true);
    const write = await service.createAnnouncement(viewer, { title: 'Nope not allowed' });
    expect(write.ok).toBe(false);
  });

  it('validation rejects a too-short title', async () => {
    const bad = await service.createAnnouncement(ctx, { title: 'Hi' });
    expect(bad.ok).toBe(false);
  });

  it('unpublish hides it; delete removes it', async () => {
    const unpublished = await service.setAnnouncementStatus(ctx, announcementId, 'draft');
    expect(unpublished.ok).toBe(true);
    expect(await service.listPublicAnnouncements(orgId)).toHaveLength(0);

    const deleted = await service.deleteAnnouncement(ctx, announcementId);
    expect(deleted.ok).toBe(true);
    const list = await service.listAnnouncements(ctx);
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.value).toHaveLength(0);
  });
});
