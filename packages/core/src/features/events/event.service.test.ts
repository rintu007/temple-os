import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  events,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createEventService } from './event.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

function isoDate(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!hasDb)('events: CRUD, publish gating, isolation (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createEventService({ db });

  const run = `ev${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  const outsider = { userId: randomUUID(), email: `out-${run}@test.invalid`, fullName: 'Out' };
  let orgId = '';
  let otherOrgId = '';
  let eventId = '';

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
      await admin.delete(events).where(inArray(events.organizationId, orgIds));
      await admin.delete(memberships).where(inArray(memberships.organizationId, orgIds));
      await admin.delete(roles).where(inArray(roles.organizationId, orgIds));
      await admin.delete(domains).where(inArray(domains.organizationId, orgIds));
      await admin.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId, outsider.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up organizations', async () => {
    const a = await orgService.provisionOrganization(
      systemContext('event test'),
      { name: 'Event Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(a.ok).toBe(true);
    if (a.ok) orgId = a.value.id;

    const b = await orgService.provisionOrganization(
      systemContext('event test'),
      { name: 'Other Org', slug: `${run}-other`, country: 'BD' },
      outsider,
    );
    expect(b.ok).toBe(true);
    if (b.ok) otherOrgId = b.value.id;
  });

  it('creates events and festivals with computed timestamps', async () => {
    const timed = await service.createEvent(ctx(), {
      title: 'Satsang Evening',
      kind: 'event',
      date: isoDate(7),
      startTime: '18:30',
      endTime: '20:00',
      location: 'Main hall',
    });
    expect(timed.ok).toBe(true);
    if (timed.ok) {
      eventId = timed.value.id;
      expect(timed.value.allDay).toBe(false);
      expect(timed.value.endsAt).not.toBeNull();
    }

    const festival = await service.createEvent(ctx(), {
      title: 'Durga Puja',
      kind: 'festival',
      date: isoDate(30),
      endDate: isoDate(34),
    });
    expect(festival.ok).toBe(true);
    if (festival.ok) {
      expect(festival.value.kind).toBe('festival');
      expect(festival.value.allDay).toBe(true);
    }

    const draft = await service.createEvent(ctx(), {
      title: 'Draft Planning Meet',
      kind: 'event',
      date: isoDate(3),
      isPublished: false,
    });
    expect(draft.ok).toBe(true);

    const past = await service.createEvent(ctx(), {
      title: 'Last Month Kirtan',
      kind: 'event',
      date: isoDate(-30),
    });
    expect(past.ok).toBe(true);
  });

  it('rejects invalid ranges', async () => {
    const badRange = await service.createEvent(ctx(), {
      title: 'Backwards',
      kind: 'event',
      date: isoDate(10),
      endDate: isoDate(5),
    });
    expect(badRange.ok).toBe(false);
  });

  it('lists upcoming vs past', async () => {
    const upcoming = await service.listEvents(ctx(), { scope: 'upcoming' });
    expect(upcoming.ok).toBe(true);
    if (upcoming.ok) {
      expect(upcoming.value.total).toBe(3); // timed + festival + draft
      expect(upcoming.value.items[0]?.title).toBe('Draft Planning Meet'); // soonest first
    }

    const past = await service.listEvents(ctx(), { scope: 'past' });
    expect(past.ok).toBe(true);
    if (past.ok) expect(past.value.total).toBe(1);
  });

  it('public listing shows only published upcoming events', async () => {
    const publicEvents = await service.listPublicUpcoming(orgId);
    const titles = publicEvents.map((e) => e.title);
    expect(titles).toContain('Satsang Evening');
    expect(titles).toContain('Durga Puja');
    expect(titles).not.toContain('Draft Planning Meet'); // unpublished
    expect(titles).not.toContain('Last Month Kirtan'); // past
  });

  it('updates and deletes; viewer denied', async () => {
    const updated = await service.updateEvent(ctx(), eventId, {
      title: 'Satsang & Bhajan Evening',
      kind: 'event',
      date: isoDate(7),
      startTime: '19:00',
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.value.title).toBe('Satsang & Bhajan Evening');

    const viewerDenied = await service.createEvent(
      { ...ctx(), roleKey: 'viewer' },
      { title: 'Nope', kind: 'event', date: isoDate(1) },
    );
    expect(viewerDenied.ok).toBe(false);

    const deleted = await service.deleteEvent(ctx(), eventId);
    expect(deleted.ok).toBe(true);
    const gone = await service.getEvent(ctx(), eventId);
    expect(gone.ok).toBe(false);
  });

  it('other tenant sees nothing', async () => {
    const outsiderCtx: TenantContext = {
      organizationId: otherOrgId,
      userId: outsider.userId,
      roleKey: 'owner',
      templeIds: null,
    };
    const list = await service.listEvents(outsiderCtx, { scope: 'upcoming' });
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.value.total).toBe(0);

    const publicEvents = await service.listPublicUpcoming(otherOrgId);
    expect(publicEvents).toHaveLength(0);
  });
});
