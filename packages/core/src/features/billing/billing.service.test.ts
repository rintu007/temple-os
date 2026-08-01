import { createHmac, randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
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
import { createPlanService } from '../plans/plan.service';
import { createBillingService } from './billing.service';
import { createStripeBillingClient } from './stripe-billing';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

/** Mirrors Stripe's own header format so constructWebhookEvent can be exercised without a live key. */
function signedHeader(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe.skipIf(!hasDb)('billing: trial provisioning + access control (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const billing$ = createBillingService({ db });
  const plan$ = createPlanService({ db });

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
    const proPlan = await plan$.getPlan('pro');
    if (proPlan && billing$.isConfigured(proPlan)) return; // this env has billing configured — nothing to assert
    const checkout = await billing$.createUpgradeCheckout(ownerCtx, 'pro', 'https://admin.test.invalid');
    expect(checkout.ok).toBe(false);

    const portal = await billing$.createPortalSession(ownerCtx, 'https://admin.test.invalid');
    expect(portal.ok).toBe(false);
  });

  it('grants a limited (Growth-tier) module set during an unexpired trial — not every module', async () => {
    const modules = await billing$.getEntitledModules(ownerCtx);
    expect(modules).not.toBe('all');
    if (modules !== 'all') {
      expect(modules.has('worship')).toBe(true);
      expect(modules.has('community')).toBe(true);
      expect(modules.has('finance-basic')).toBe(true);
      expect(modules.has('accounting')).toBe(false);
    }
  });

  it('falls back to Starter (no gated modules) once the trial has expired', async () => {
    await admin
      .update(platformSubscriptions)
      .set({ trialEndsAt: new Date(Date.now() - 60_000) })
      .where(eq(platformSubscriptions.organizationId, orgId));

    const modules = await billing$.getEntitledModules(ownerCtx);
    expect(modules).not.toBe('all');
    if (modules !== 'all') expect(modules.size).toBe(0);
  });

  it('grants only Growth-tier modules on an active Growth subscription', async () => {
    await admin
      .update(platformSubscriptions)
      .set({ plan: 'growth', status: 'active' })
      .where(eq(platformSubscriptions.organizationId, orgId));

    const modules = await billing$.getEntitledModules(ownerCtx);
    expect(modules).not.toBe('all');
    if (modules !== 'all') {
      expect(modules.has('worship')).toBe(true);
      expect(modules.has('community')).toBe(true);
      expect(modules.has('finance-basic')).toBe(true);
      expect(modules.has('accounting')).toBe(false);
    }
  });

  it('grants every module on an active Pro subscription', async () => {
    await admin
      .update(platformSubscriptions)
      .set({ plan: 'pro', status: 'active' })
      .where(eq(platformSubscriptions.organizationId, orgId));

    const modules = await billing$.getEntitledModules(ownerCtx);
    expect(modules).not.toBe('all');
    if (modules !== 'all') expect(modules.has('accounting')).toBe(true);
  });

  it('falls back to Starter when a subscription is past_due or canceled', async () => {
    await admin
      .update(platformSubscriptions)
      .set({ status: 'canceled' })
      .where(eq(platformSubscriptions.organizationId, orgId));

    const modules = await billing$.getEntitledModules(ownerCtx);
    expect(modules).not.toBe('all');
    if (modules !== 'all') expect(modules.size).toBe(0);
  });

  it('fails open (unrestricted) for a legacy org with no subscription row', async () => {
    await admin
      .delete(platformSubscriptions)
      .where(eq(platformSubscriptions.organizationId, orgId));

    const modules = await billing$.getEntitledModules(ownerCtx);
    expect(modules).toBe('all');

    // Recreate the row so afterAll's cleanup (and any later test) has something to delete/find.
    await admin.insert(platformSubscriptions).values({
      organizationId: orgId,
      plan: 'trial',
      status: 'trialing',
    });
  });

  it('getBillingNoticeContext returns the organization name and its active owner(s)', async () => {
    const context = await billing$.getBillingNoticeContext(orgId);
    expect(context.organizationName).toBe('Billing Org');
    expect(context.owners).toEqual(
      expect.arrayContaining([expect.objectContaining({ email: owner.email })]),
    );
  });

  it('flags a payment-failed notice only on the transition into past_due, not on repeated webhook deliveries', async () => {
    const secret = 'whsec_billing_notice_test';
    const client = createStripeBillingClient({ secretKey: 'sk_test_dummy', webhookSecret: secret });

    const payload1 = JSON.stringify({
      id: 'evt_past_due_1',
      type: 'customer.subscription.updated',
      data: { object: { status: 'past_due', metadata: { organizationId: orgId } } },
    });
    const first = await billing$.handleStripeEvent(payload1, signedHeader(payload1, secret), client);
    expect(first.outcome).toBe('confirmed');
    if (first.outcome === 'confirmed') expect(first.becamePastDue).toBe(true);

    // Stripe retries/re-sends the same status on the still-past-due subscription — must not re-flag.
    const payload2 = JSON.stringify({
      id: 'evt_past_due_2',
      type: 'customer.subscription.updated',
      data: { object: { status: 'past_due', metadata: { organizationId: orgId } } },
    });
    const second = await billing$.handleStripeEvent(payload2, signedHeader(payload2, secret), client);
    expect(second.outcome).toBe('confirmed');
    if (second.outcome === 'confirmed') expect(second.becamePastDue).toBe(false);

    // Restore to trialing so later tests (and the shared DB) aren't left with a stray past_due org.
    await admin
      .update(platformSubscriptions)
      .set({ status: 'trialing' })
      .where(eq(platformSubscriptions.organizationId, orgId));
  });

  it('lists trials ending within the reminder window and stops once reminded', async () => {
    const soon = new Date(Date.now() + 2 * 24 * 3_600_000); // 2 days out
    await admin
      .update(platformSubscriptions)
      .set({ status: 'trialing', trialEndsAt: soon, trialReminderSentAt: null })
      .where(eq(platformSubscriptions.organizationId, orgId));

    const before = await billing$.listTrialsEndingSoon(3);
    const match = before.find((t) => t.organizationId === orgId);
    expect(match?.ownerEmail).toBe(owner.email);
    expect(match?.organizationName).toBe('Billing Org');

    await billing$.markTrialReminderSent(orgId);

    const after = await billing$.listTrialsEndingSoon(3);
    expect(after.some((t) => t.organizationId === orgId)).toBe(false);
  });

  it('excludes trials ending outside the reminder window', async () => {
    await admin
      .update(platformSubscriptions)
      .set({
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 10 * 24 * 3_600_000),
        trialReminderSentAt: null,
      })
      .where(eq(platformSubscriptions.organizationId, orgId));

    const results = await billing$.listTrialsEndingSoon(3);
    expect(results.some((t) => t.organizationId === orgId)).toBe(false);
  });
});

describe.skipIf(!hasDb)('billing webhook without Stripe configured', () => {
  it('reports not_configured rather than throwing', async () => {
    const billing$ = createBillingService({ db: createDb() });
    const result = await billing$.handleStripeEvent('{}', 't=1,v1=deadbeef');
    expect(result.outcome).toBe('not_configured');
  });
});
