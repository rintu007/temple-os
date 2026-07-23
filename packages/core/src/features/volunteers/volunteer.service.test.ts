import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  memberships,
  organizations,
  roles,
  users,
  volunteerOpportunities,
  volunteerSignups,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createVolunteerService } from './volunteer.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('volunteers: opportunities, public sign-up, roster (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createVolunteerService({ db });

  const run = `vol${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let opportunityId = '';

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(volunteerSignups).where(inArray(volunteerSignups.organizationId, [orgId]));
      await admin
        .delete(volunteerOpportunities)
        .where(inArray(volunteerOpportunities.organizationId, [orgId]));
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
      systemContext('volunteer test'),
      { name: 'Volunteer Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };
  });

  it('creates an open opportunity with a slot cap', async () => {
    const created = await service.createOpportunity(ctx, {
      title: 'Annakut kitchen help',
      description: 'Chopping and serving.',
      servingOn: '2026-11-01',
      slotsNeeded: 2,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      opportunityId = created.value.id;
      expect(created.value.status).toBe('open');
      expect(created.value.signupCount).toBe(0);
    }
  });

  it('rejects a too-short title and viewer writes', async () => {
    const bad = await service.createOpportunity(ctx, { title: 'Hi', slotsNeeded: 0 });
    expect(bad.ok).toBe(false);
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const forbidden = await service.createOpportunity(viewer, {
      title: 'Valid title here',
      slotsNeeded: 0,
    });
    expect(forbidden.ok).toBe(false);
  });

  it('the public list shows the open opportunity, not full yet', async () => {
    const open = await service.listOpenOpportunities(orgId);
    expect(open).toHaveLength(1);
    expect(open[0]?.full).toBe(false);
  });

  it('public sign-up records the volunteer and raises the count', async () => {
    const signup = await service.signUp(orgId, {
      opportunityId,
      name: 'Ramesh Volunteer',
      phone: '+91 90000 00000',
    });
    expect(signup.ok).toBe(true);
    if (signup.ok) expect(signup.value.name).toBe('Ramesh Volunteer');

    const detail = await service.getOpportunity(ctx, opportunityId);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.value.opportunity.signupCount).toBe(1);
      expect(detail.value.signups).toHaveLength(1);
      expect(detail.value.signups[0]?.name).toBe('Ramesh Volunteer');
    }
  });

  it('fills the last slot and marks the opportunity full', async () => {
    const second = await service.signUp(orgId, { opportunityId, name: 'Sita Volunteer' });
    expect(second.ok).toBe(true);

    const open = await service.listOpenOpportunities(orgId);
    expect(open[0]?.full).toBe(true); // 2 of 2
  });

  it('closing the opportunity blocks new sign-ups and hides it publicly', async () => {
    const closed = await service.setOpportunityStatus(ctx, opportunityId, 'closed');
    expect(closed.ok).toBe(true);

    const late = await service.signUp(orgId, { opportunityId, name: 'Too Late' });
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.error.code).toBe('CONFLICT');

    expect(await service.listOpenOpportunities(orgId)).toHaveLength(0);
  });

  it('signing up for an unknown opportunity fails cleanly', async () => {
    const missing = await service.signUp(orgId, { opportunityId: randomUUID(), name: 'Nobody' });
    expect(missing.ok).toBe(false);
  });
});
