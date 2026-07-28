import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  devoteeLoginTokens,
  devotees,
  devoteeSessions,
  domains,
  donationCategories,
  donationCounters,
  donations,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createDevoteeService } from '../devotees/devotee.service';
import { createDonationService } from '../donations/donation.service';
import { createOrganizationService } from '../organizations/organization.service';
import { createDonorPortalService } from './donor-portal.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('donor portal: magic-link login + scoped donation history (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const devotee$ = createDevoteeService({ db });
  const donation$ = createDonationService({ db });
  const portal$ = createDonorPortalService({ db });

  const run = `dpt${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ownerCtx: TenantContext;
  let devoteeAId = '';
  let devoteeBId = '';
  let donationAId = '';
  let donationBId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(devoteeSessions).where(inArray(devoteeSessions.organizationId, s));
      await admin.delete(devoteeLoginTokens).where(inArray(devoteeLoginTokens.organizationId, s));
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(donations).where(inArray(donations.organizationId, s));
      await admin.delete(donationCounters).where(inArray(donationCounters.organizationId, s));
      await admin.delete(donationCategories).where(inArray(donationCategories.organizationId, s));
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

  it('sets up an org with two devotees, each with their own donation', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('donor-portal test'),
      { name: 'Portal Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ownerCtx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const a = await devotee$.createDevotee(ownerCtx, {
      fullName: 'Devotee A',
      email: `a-${run}@test.invalid`,
    });
    const b = await devotee$.createDevotee(ownerCtx, {
      fullName: 'Devotee B',
      email: `b-${run}@test.invalid`,
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    devoteeAId = a.value.id;
    devoteeBId = b.value.id;

    const donA = await donation$.recordDonation(ownerCtx, {
      devoteeId: devoteeAId,
      amount: 1100,
      method: 'cash',
      donatedOn: '2026-06-01',
    });
    const donB = await donation$.recordDonation(ownerCtx, {
      devoteeId: devoteeBId,
      amount: 2200,
      method: 'cash',
      donatedOn: '2026-06-02',
    });
    expect(donA.ok).toBe(true);
    expect(donB.ok).toBe(true);
    if (!donA.ok || !donB.ok) return;
    donationAId = donA.value.id;
    donationBId = donB.value.id;
  });

  it('does not reveal whether an email is registered', async () => {
    const unknown = await portal$.requestLogin(orgId, `nobody-${run}@test.invalid`);
    expect(unknown.ok).toBe(true);
    if (unknown.ok) expect(unknown.value).toBeNull();
  });

  it('rejects a bogus or already-used login token', async () => {
    const bogus = await portal$.verifyLogin(orgId, 'not-a-real-token');
    expect(bogus.ok).toBe(false);
    if (!bogus.ok) expect(bogus.error.code).toBe('NOT_FOUND');
  });

  let sessionTokenA = '';

  it('issues a login token for a known devotee email and exchanges it once for a session', async () => {
    const requested = await portal$.requestLogin(orgId, `a-${run}@test.invalid`);
    expect(requested.ok).toBe(true);
    if (!requested.ok || !requested.value) return;
    expect(requested.value.devoteeName).toBe('Devotee A');

    const verified = await portal$.verifyLogin(orgId, requested.value.token);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    sessionTokenA = verified.value.sessionToken;

    // Single-use: verifying the same token again fails.
    const reused = await portal$.verifyLogin(orgId, requested.value.token);
    expect(reused.ok).toBe(false);
  });

  it('resolves the session to the right devotee', async () => {
    const session = await portal$.getSession(orgId, sessionTokenA);
    expect(session).not.toBeNull();
    expect(session?.devoteeId).toBe(devoteeAId);
    expect(session?.devoteeName).toBe('Devotee A');
  });

  it("giving summary and donation list show only this devotee's own donations", async () => {
    const session = await portal$.getSession(orgId, sessionTokenA);
    if (!session) throw new Error('session missing');

    const summary = await portal$.getGivingSummary(session);
    expect(summary.ok).toBe(true);
    if (summary.ok) {
      expect(summary.value.lifetimeCount).toBe(1);
      expect(summary.value.lifetimeTotal).toBe('1100.00');
    }

    const list = await portal$.listDonations(session, 1);
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value.total).toBe(1);
      expect(list.value.items[0]?.id).toBe(donationAId);
    }
  });

  it('cannot fetch another devotee\'s receipt even by guessing the donation id', async () => {
    const session = await portal$.getSession(orgId, sessionTokenA);
    if (!session) throw new Error('session missing');

    const ownReceipt = await portal$.getReceipt(session, donationAId);
    expect(ownReceipt.ok).toBe(true);

    const otherReceipt = await portal$.getReceipt(session, donationBId);
    expect(otherReceipt.ok).toBe(false);
    if (!otherReceipt.ok) expect(otherReceipt.error.code).toBe('NOT_FOUND');
  });

  it('logging out invalidates the session', async () => {
    await portal$.logout(orgId, sessionTokenA);
    const session = await portal$.getSession(orgId, sessionTokenA);
    expect(session).toBeNull();
  });
});
