import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  galleryImages,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createGalleryService } from './gallery.service';
import { extensionForContentType, storageFromEnv } from './storage';

describe('extensionForContentType', () => {
  it('maps supported types and rejects others', () => {
    expect(extensionForContentType('image/jpeg')).toBe('jpg');
    expect(extensionForContentType('IMAGE/PNG')).toBe('png');
    expect(extensionForContentType('image/webp')).toBe('webp');
    expect(extensionForContentType('image/svg+xml')).toBeNull(); // SVG can carry scripts
    expect(extensionForContentType('application/pdf')).toBeNull();
  });
});

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);
const hasStorage = storageFromEnv() !== null;

// 1×1 transparent PNG
const PNG_BYTES = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

describe.skipIf(!hasDb || !hasStorage)('gallery: upload, delete, isolation (live storage + db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createGalleryService({ db });

  const run = `gal${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let otherOrgId = '';
  let imageId = '';

  const ctx = (roleKey = 'owner'): TenantContext => ({
    organizationId: orgId,
    userId: owner.userId,
    roleKey,
    templeIds: null,
  });

  afterAll(async () => {
    const orgIds = [orgId, otherOrgId].filter(Boolean);
    if (orgIds.length > 0) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, orgIds));
      await admin.delete(galleryImages).where(inArray(galleryImages.organizationId, orgIds));
      await admin.delete(memberships).where(inArray(memberships.organizationId, orgIds));
      await admin.delete(roles).where(inArray(roles.organizationId, orgIds));
      await admin.delete(domains).where(inArray(domains.organizationId, orgIds));
      await admin.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up organizations', async () => {
    const a = await orgService.provisionOrganization(
      systemContext('gallery test'),
      { name: 'Gallery Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(a.ok).toBe(true);
    if (a.ok) orgId = a.value.id;

    const b = await orgService.provisionOrganization(
      systemContext('gallery test'),
      { name: 'Other Org', slug: `${run}-other`, country: 'BD' },
      { userId: randomUUID(), email: `out-${run}@test.invalid` },
    );
    expect(b.ok).toBe(true);
    if (b.ok) otherOrgId = b.value.id;
  });

  it('uploads a real image to Supabase Storage; staff denied; bad types rejected', async () => {
    const denied = await service.uploadImage(ctx('staff'), {
      bytes: PNG_BYTES,
      contentType: 'image/png',
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');

    const badType = await service.uploadImage(ctx(), {
      bytes: PNG_BYTES,
      contentType: 'image/svg+xml',
    });
    expect(badType.ok).toBe(false);

    const uploaded = await service.uploadImage(ctx(), {
      bytes: PNG_BYTES,
      contentType: 'image/png',
      caption: 'Sandhya aarti',
    });
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    imageId = uploaded.value.id;
    expect(uploaded.value.caption).toBe('Sandhya aarti');

    // The public URL must actually serve the object
    const res = await fetch(uploaded.value.url);
    expect(res.status).toBe(200);
  });

  it('lists images (admin + public); other tenant sees none', async () => {
    const list = await service.listImages(ctx());
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.value).toHaveLength(1);

    const publicList = await service.listPublicImages(orgId);
    expect(publicList).toHaveLength(1);

    const otherList = await service.listPublicImages(otherOrgId);
    expect(otherList).toHaveLength(0);
  });

  it('deletes the image row and storage object', async () => {
    const deleted = await service.deleteImage(ctx(), imageId);
    expect(deleted.ok).toBe(true);

    const list = await service.listImages(ctx());
    if (list.ok) expect(list.value).toHaveLength(0);

    const again = await service.deleteImage(ctx(), imageId);
    expect(again.ok).toBe(false);
  });
});
