import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  broadcasts,
  createDb,
  devotees,
  domains,
  donations,
  memberships,
  membershipSubscriptions,
  newId,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createCommunicationService } from './communication.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('communications: devotee broadcasts (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createCommunicationService({ db });

  const run = `com${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  const donorDevoteeId = newId();
  const plainDevoteeId = newId();
  const noEmailDevoteeId = newId();
  const archivedDevoteeId = newId();

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(broadcasts).where(inArray(broadcasts.organizationId, s));
      await admin.delete(membershipSubscriptions).where(inArray(membershipSubscriptions.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(devotees).where(inArray(devotees.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and seeds a devotee base', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('comms test'),
      { name: 'Comms Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    await admin.insert(devotees).values([
      { id: donorDevoteeId, organizationId: orgId, fullName: 'Aditi Donor', email: 'aditi@test.invalid', status: 'active' },
      { id: plainDevoteeId, organizationId: orgId, fullName: 'Bala Plain', email: 'bala@test.invalid', status: 'active' },
      { id: noEmailDevoteeId, organizationId: orgId, fullName: 'Chandra NoEmail', status: 'active' },
      { id: archivedDevoteeId, organizationId: orgId, fullName: 'Deep Archived', email: 'deep@test.invalid', status: 'archived' },
    ]);

    await admin.insert(donations).values({
      id: newId(),
      organizationId: orgId,
      devoteeId: donorDevoteeId,
      donorName: 'Aditi Donor',
      amount: '500.00',
      currency: 'INR',
      method: 'cash',
      receiptNumber: `${run}-R1`,
      status: 'recorded',
    });

    await admin.insert(membershipSubscriptions).values({
      id: newId(),
      organizationId: orgId,
      devoteeId: donorDevoteeId,
      planName: 'Annual',
      memberName: 'Aditi Donor',
      amount: '1000.00',
      currency: 'INR',
      status: 'active',
    });
  });

  it('counts reach per segment, excluding archived and email-less devotees', async () => {
    const counts = await service.getSegmentCounts(ctx);
    expect(counts.ok).toBe(true);
    if (counts.ok) {
      expect(counts.value.all).toBe(2); // Aditi + Bala (not Chandra, not archived Deep)
      expect(counts.value.donors).toBe(1); // Aditi
      expect(counts.value.members).toBe(1); // Aditi
    }
  });

  it('resolves the recipient list for a segment', async () => {
    const all = await service.getRecipients(ctx, 'all');
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.value.map((r) => r.email).sort()).toEqual([
        'aditi@test.invalid',
        'bala@test.invalid',
      ]);
    }

    const donors = await service.getRecipients(ctx, 'donors');
    expect(donors.ok && donors.value).toHaveLength(1);
  });

  it('records a broadcast and derives delivery status', async () => {
    const sent = await service.recordBroadcast(
      ctx,
      { subject: 'Temple festival this weekend', message: 'Please join us for the celebrations.', segment: 'all' },
      { recipientCount: 2, sentCount: 2, failedCount: 0 },
    );
    expect(sent.ok).toBe(true);
    if (sent.ok) expect(sent.value.status).toBe('sent');

    const partial = await service.recordBroadcast(
      ctx,
      { subject: 'Second notice about the mela', message: 'A reminder about this weekend.', segment: 'donors' },
      { recipientCount: 2, sentCount: 1, failedCount: 1 },
    );
    expect(partial.ok && partial.value.status).toBe('partial');
  });

  it('validates the compose input', async () => {
    const bad = await service.recordBroadcast(
      ctx,
      { subject: 'x', message: 'too short', segment: 'all' },
      { recipientCount: 1, sentCount: 1, failedCount: 0 },
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALIDATION');
  });

  it('lists broadcast history newest first', async () => {
    const list = await service.listBroadcasts(ctx);
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value).toHaveLength(2);
      expect(list.value[0]?.subject).toBe('Second notice about the mela');
    }
  });

  it('a viewer can see counts but not recipients or sending', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const counts = await service.getSegmentCounts(viewer);
    expect(counts.ok).toBe(true);

    const recipients = await service.getRecipients(viewer, 'all');
    expect(recipients.ok).toBe(false);
    if (!recipients.ok) expect(recipients.error.code).toBe('FORBIDDEN');

    const record = await service.recordBroadcast(
      viewer,
      { subject: 'Nope this should fail', message: 'This should be forbidden.', segment: 'all' },
      { recipientCount: 1, sentCount: 1, failedCount: 0 },
    );
    expect(record.ok).toBe(false);
  });
});
