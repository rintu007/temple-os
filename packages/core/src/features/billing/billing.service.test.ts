import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  memberships,
  organizations,
  platformSubscriptions,
  roles,
  users,
} from '@templeos/db';
import { TRIAL_LENGTH_DAYS } from '@templeos/validators';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createBillingService } from './billing.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('billing: trial provisioning + access control (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const billing$ = createBillingService({ db });

  const run = `bill${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ownerCtx: TenantContext;
  let viewerCtx: TenantContext;

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(platformSubscriptions).where(inArray(platformSubscriptions.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('seeds a trial subscription when the organization is provisioned', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('billing test'),
      { name: 'Billing Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (!provisioned.ok) return;
    orgId = provisioned.value.id;
    ownerCtx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };
    viewerCtx = { organizationId: orgId, userId: owner.userId, roleKey: 'viewer', templeIds: null };

    const status = await billing$.getStatus(ownerCtx);
    expect(status.ok).toBe(true);
    if (!status.ok || !status.value) return;
    expect(status.value.plan).toBe('trial');
    expect(status.value.status).toBe('trialing');
    expect(status.value.hasStripeCustomer).toBe(false);
    expect(status.value.isTrialExpired).toBe(false);
    const daysUntilTrialEnd = status.value.trialEndsAt
      ? (status.value.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      : 0;
    expect(daysUntilTrialEnd).toBeGreaterThan(TRIAL_LENGTH_DAYS - 1);
    expect(daysUntilTrialEnd).toBeLessThanOrEqual(TRIAL_LENGTH_DAYS);
  });

  it('denies billing access to a role without organization:manage', async () => {
    const status = await billing$.getStatus(viewerCtx);
    expect(status.ok).toBe(false);
    if (!status.ok) expect(status.error.code).toBe('FORBIDDEN');
  });

  it('rejects checkout/portal creation when Stripe billing is not configured', async () => {
    if (billing$.isConfigured()) return; // this env has billing configured — nothing to assert
    const checkout = await billing$.createUpgradeCheckout(ownerCtx, 'https://admin.test.invalid');
    expect(checkout.ok).toBe(false);

    const portal = await billing$.createPortalSession(ownerCtx, 'https://admin.test.invalid');
    expect(portal.ok).toBe(false);
  });
});

describe.skipIf(!hasDb)('billing webhook without Stripe configured', () => {
  it('reports not_configured rather than throwing', async () => {
    const billing$ = createBillingService({ db: createDb() });
    const result = await billing$.handleStripeEvent('{}', 't=1,v1=deadbeef');
    expect(result.outcome).toBe('not_configured');
  });
});
