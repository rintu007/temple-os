import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  contactMessages,
  createDb,
  domains,
  memberships,
  organizations,
  roles,
  siteSettings,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createWebsiteService } from './website.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('website: settings, contact messages, RBAC, isolation (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createWebsiteService({ db });

  const run = `web${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let otherOrgId = '';

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
      await admin.delete(contactMessages).where(inArray(contactMessages.organizationId, orgIds));
      await admin.delete(siteSettings).where(inArray(siteSettings.organizationId, orgIds));
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
      systemContext('website test'),
      { name: 'Website Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(a.ok).toBe(true);
    if (a.ok) orgId = a.value.id;

    const b = await orgService.provisionOrganization(
      systemContext('website test'),
      { name: 'Other Org', slug: `${run}-other`, country: 'BD' },
      { userId: randomUUID(), email: `out-${run}@test.invalid` },
    );
    expect(b.ok).toBe(true);
    if (b.ok) otherOrgId = b.value.id;
  });

  it('returns empty defaults, then upserts settings (staff denied)', async () => {
    const empty = await service.getSettings(ctx());
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.value.aboutText).toBeNull();

    const denied = await service.updateSettings(ctx('staff'), { tagline: 'Nope' });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');

    const saved = await service.updateSettings(ctx(), {
      tagline: 'A home of devotion since 1952',
      aboutText: 'Our temple serves the community.\n\nAll are welcome.',
      contactEmail: 'temple@example.com',
      contactPhone: '+91 90000 00000',
      addressText: '12 Temple Road, Kolkata',
      facebookUrl: 'https://facebook.com/demotemple',
    });
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.value.tagline).toBe('A home of devotion since 1952');

    // Upsert overwrites
    const updated = await service.updateSettings(ctx(), {
      tagline: 'Updated tagline',
      contactEmail: 'temple@example.com',
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.tagline).toBe('Updated tagline');
      expect(updated.value.aboutText).toBeNull(); // full replace, not merge
    }
  });

  it('serves public content without auth', async () => {
    const content = await service.getPublicContent(orgId);
    expect(content.tagline).toBe('Updated tagline');

    const otherContent = await service.getPublicContent(otherOrgId);
    expect(otherContent.tagline).toBeNull(); // isolation: other org untouched
  });

  it('accepts contact messages publicly and lists them in the inbox', async () => {
    const rejected = await service.submitContactMessage(orgId, {
      name: 'X',
      message: 'short',
    });
    expect(rejected.ok).toBe(false);

    const noContact = await service.submitContactMessage(orgId, {
      name: 'Anita Roy',
      message: 'I would like to sponsor a puja next month.',
    });
    expect(noContact.ok).toBe(false); // needs email or phone

    const submitted = await service.submitContactMessage(orgId, {
      name: 'Anita Roy',
      email: 'anita@example.com',
      message: 'I would like to sponsor a puja next month.',
    });
    expect(submitted.ok).toBe(true);
    if (submitted.ok) {
      expect(submitted.value.notifyEmail).toBe('temple@example.com');
      expect(submitted.value.senderName).toBe('Anita Roy');
    }

    const inbox = await service.listMessages(ctx(), {});
    expect(inbox.ok).toBe(true);
    if (inbox.ok) {
      expect(inbox.value.total).toBe(1);
      expect(inbox.value.newCount).toBe(1);
      expect(inbox.value.items[0]?.status).toBe('new');
    }
  });

  it('marks messages read; staff cannot', async () => {
    const inbox = await service.listMessages(ctx(), {});
    const messageId = inbox.ok ? inbox.value.items[0]?.id : undefined;
    expect(messageId).toBeTruthy();

    const denied = await service.markMessageRead(ctx('staff'), messageId!);
    expect(denied.ok).toBe(false);

    const marked = await service.markMessageRead(ctx(), messageId!);
    expect(marked.ok).toBe(true);

    const after = await service.listMessages(ctx(), {});
    if (after.ok) expect(after.value.newCount).toBe(0);
  });

  it('other tenant sees no messages', async () => {
    const outsiderCtx: TenantContext = {
      organizationId: otherOrgId,
      userId: randomUUID(),
      roleKey: 'owner',
      templeIds: null,
    };
    const inbox = await service.listMessages(outsiderCtx, {});
    expect(inbox.ok).toBe(true);
    if (inbox.ok) expect(inbox.value.total).toBe(0);
  });
});
