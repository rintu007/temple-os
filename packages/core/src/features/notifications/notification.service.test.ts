import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  devotees,
  domains,
  memberships,
  notificationReads,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDevoteeService } from '../devotees/devotee.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createNotificationService } from './notification.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('notifications: tray derived from the activity trail (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const devotee$ = createDevoteeService({ db });
  const notification$ = createNotificationService({ db });

  const run = `ntf${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  const staffer = { userId: randomUUID(), email: `stf-${run}@test.invalid`, fullName: 'Staffer' };
  let orgId = '';
  let ownerCtx: TenantContext;
  let staffCtx: TenantContext;

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(notificationReads).where(inArray(notificationReads.organizationId, s));
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(devotees).where(inArray(devotees.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId, staffer.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org with an owner and a second staff member', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('notification test'),
      { name: 'Notify Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ownerCtx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const [staffRole] = await admin
      .select()
      .from(roles)
      .where(and(eq(roles.organizationId, orgId), eq(roles.key, 'staff')));
    expect(staffRole).toBeDefined();

    await admin
      .insert(users)
      .values({ id: staffer.userId, email: staffer.email, fullName: staffer.fullName });
    await admin.insert(memberships).values({
      organizationId: orgId,
      userId: staffer.userId,
      roleId: staffRole!.id,
    });
    staffCtx = { organizationId: orgId, userId: staffer.userId, roleKey: 'staff', templeIds: null };
  });

  it('starts with an empty feed', async () => {
    const feed = await notification$.getFeed(ownerCtx);
    expect(feed.ok).toBe(true);
    if (feed.ok) expect(feed.value.items).toHaveLength(0);
  });

  it('surfaces another member\'s action as unread, but not your own', async () => {
    const created = await devotee$.createDevotee(staffCtx, { fullName: 'Ram Devotee' });
    expect(created.ok).toBe(true);

    const ownerFeed = await notification$.getFeed(ownerCtx);
    expect(ownerFeed.ok).toBe(true);
    if (ownerFeed.ok) {
      expect(ownerFeed.value.items).toHaveLength(1);
      expect(ownerFeed.value.items[0]?.action).toBe('devotee.created');
      expect(ownerFeed.value.items[0]?.title).toBe('Devotee created');
      expect(ownerFeed.value.items[0]?.actorName).toBe('Staffer');
      expect(ownerFeed.value.items[0]?.unread).toBe(true);
      expect(ownerFeed.value.unreadCount).toBe(1);
    }

    // The actor doesn't see their own action as a notification to themselves —
    // staff's feed shows the owner's org-creation (never seen before), not
    // their own devotee.created.
    const staffFeed = await notification$.getFeed(staffCtx);
    expect(staffFeed.ok).toBe(true);
    if (staffFeed.ok) {
      expect(staffFeed.value.items).toHaveLength(1);
      expect(staffFeed.value.items[0]?.action).toBe('organization.created');
      expect(staffFeed.value.items[0]?.actorName).toBe('Owner');
    }
  });

  it('marking read clears the unread count but keeps the feed', async () => {
    const marked = await notification$.markRead(ownerCtx);
    expect(marked.ok).toBe(true);

    const feed = await notification$.getFeed(ownerCtx);
    expect(feed.ok).toBe(true);
    if (feed.ok) {
      expect(feed.value.unreadCount).toBe(0);
      expect(feed.value.items).toHaveLength(1);
      expect(feed.value.items[0]?.unread).toBe(false);
    }
  });

  it('a new action after the read cursor is unread again', async () => {
    const created = await devotee$.createDevotee(staffCtx, { fullName: 'Shyam Devotee' });
    expect(created.ok).toBe(true);

    const feed = await notification$.getFeed(ownerCtx);
    expect(feed.ok).toBe(true);
    if (feed.ok) {
      expect(feed.value.items).toHaveLength(2);
      expect(feed.value.unreadCount).toBe(1);
      expect(feed.value.items[0]?.unread).toBe(true);
      expect(feed.value.items[1]?.unread).toBe(false);
    }
  });
});
