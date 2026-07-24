import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  meetings,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createMeetingService } from './meeting.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('meetings: minutes log + status (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createMeetingService({ db });

  const run = `mtg${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let meetingId = '';

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(meetings).where(inArray(meetings.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an organization', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('meetings test'),
      { name: 'Meetings Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };
  });

  it('schedules a meeting with an agenda', async () => {
    const created = await service.createMeeting(ctx, {
      title: 'Quarterly board meeting',
      body: 'Board of Trustees',
      meetingOn: '2026-08-15',
      location: 'Temple office',
      agenda: '1. Budget review\n2. Festival planning',
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      meetingId = created.value.id;
      expect(created.value.status).toBe('scheduled');
      expect(created.value.minutes).toBeNull();
    }
  });

  it('validation rejects a missing date and a staff (read-only) write', async () => {
    const bad = await service.createMeeting(ctx, { title: 'No date meeting', meetingOn: '' });
    expect(bad.ok).toBe(false);

    const staff: TenantContext = { ...ctx, roleKey: 'staff' };
    const forbidden = await service.createMeeting(staff, {
      title: 'Staff meeting',
      meetingOn: '2026-09-01',
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.code).toBe('FORBIDDEN');
  });

  it('records minutes and marks the meeting held', async () => {
    const updated = await service.updateMeeting(ctx, meetingId, {
      title: 'Quarterly board meeting',
      body: 'Board of Trustees',
      meetingOn: '2026-08-15',
      location: 'Temple office',
      agenda: '1. Budget review\n2. Festival planning',
      minutes: 'Budget approved unanimously. Festival dates fixed.',
      decisions: 'Resolution 1: Approve annual budget of 20,00,000.',
      status: 'held',
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.status).toBe('held');
      expect(updated.value.minutes).toContain('Budget approved');
      expect(updated.value.decisions).toContain('Resolution 1');
    }
  });

  it('lists meetings and filters by status; staff may read', async () => {
    const held = await service.listMeetings(ctx, 'held');
    expect(held.ok && held.value).toHaveLength(1);
    const scheduled = await service.listMeetings(ctx, 'scheduled');
    expect(scheduled.ok && scheduled.value).toHaveLength(0);

    const staff: TenantContext = { ...ctx, roleKey: 'staff' };
    const staffRead = await service.listMeetings(staff, 'all');
    expect(staffRead.ok && staffRead.value).toHaveLength(1);
  });

  it('denies a viewer-role write and a bare-role read', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const write = await service.updateMeeting(viewer, meetingId, {
      title: 'Hacked',
      meetingOn: '2026-08-15',
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');

    const stranger: TenantContext = { ...ctx, roleKey: 'no_such_role' };
    const read = await service.listMeetings(stranger);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe('FORBIDDEN');
  });
});
