import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  memberships,
  organizations,
  planCatalog,
  platformAdmins,
  platformSubscriptions,
  roles,
  users,
} from '@templeos/db';
import { systemContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createPlanService } from './plan.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('plans: platform-editable catalog (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const plan$ = createPlanService({ db });

  const run = `plan${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  const staffer = { userId: randomUUID(), email: `staff-${run}@test.invalid`, fullName: 'Staffer' };
  const newKey = `${run}-custom`;
  let orgId = '';

  afterAll(async () => {
    await admin.delete(platformAdmins).where(eq(platformAdmins.userId, staffer.userId));
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(platformSubscriptions).where(inArray(platformSubscriptions.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(planCatalog).where(eq(planCatalog.key, newKey));
    await admin.delete(users).where(inArray(users.id, [owner.userId, staffer.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('lists the seeded catalog publicly, with no auth required', async () => {
    const plans = await plan$.listPlans();
    const keys = plans.map((p) => p.key);
    expect(keys).toEqual(expect.arrayContaining(['trial', 'starter', 'growth', 'pro']));

    const trial = plans.find((p) => p.key === 'trial');
    // The trial is a limited preview (Growth's modules), not every module.
    expect(trial?.modules).toEqual(
      expect.arrayContaining(['worship', 'community', 'finance-basic']),
    );
    expect(trial?.modules).not.toContain('accounting');
  });

  it('sets up an org and a separate platform-admin user', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('plans test'),
      { name: 'Plan Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (!provisioned.ok) return;
    orgId = provisioned.value.id;

    await admin.insert(users).values({ id: staffer.userId, email: staffer.email });
    await admin.insert(platformAdmins).values({ userId: staffer.userId, note: 'test grant' });
  });

  it('denies create/update/delete to a non-platform-admin', async () => {
    const created = await plan$.createPlan(owner.userId, {
      key: newKey,
      name: 'Custom',
      priceUsd: 10,
      description: 'test',
      features: [],
      modules: [],
      isPurchasable: false,
      stripePriceId: null,
      isTrialDefault: false,
      isFallbackDefault: false,
      sortOrder: 9,
    });
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.error.code).toBe('FORBIDDEN');
  });

  it('a platform admin creates a plan; a duplicate key conflicts', async () => {
    const created = await plan$.createPlan(staffer.userId, {
      key: newKey,
      name: 'Custom',
      priceUsd: 10,
      description: 'A custom mid-tier plan',
      features: ['One nice thing'],
      modules: ['worship'],
      isPurchasable: true,
      stripePriceId: null,
      isTrialDefault: false,
      isFallbackDefault: false,
      sortOrder: 9,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.name).toBe('Custom');
      expect(created.value.modules).toEqual(['worship']);
    }

    const dup = await plan$.createPlan(staffer.userId, {
      key: newKey,
      name: 'Custom again',
      priceUsd: 5,
      description: 'dup',
      features: [],
      modules: [],
      isPurchasable: false,
      stripePriceId: null,
      isTrialDefault: false,
      isFallbackDefault: false,
      sortOrder: 9,
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('CONFLICT');
  });

  it('updates a plan; setting a new trial default unsets the old one', async () => {
    const updated = await plan$.updatePlan(staffer.userId, newKey, {
      name: 'Custom',
      priceUsd: 15,
      description: 'A custom mid-tier plan',
      features: ['One nice thing', 'Two nice things'],
      modules: ['worship', 'community'],
      isPurchasable: true,
      stripePriceId: null,
      isTrialDefault: true,
      isFallbackDefault: false,
      sortOrder: 9,
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.priceUsd).toBe(15);
      expect(updated.value.modules).toEqual(['worship', 'community']);
      expect(updated.value.isTrialDefault).toBe(true);
    }

    const oldTrial = await plan$.getPlan('trial');
    expect(oldTrial?.isTrialDefault).toBe(false);

    // Restore, so the rest of the suite (and other test files) sees 'trial' as the default again.
    const restored = await plan$.updatePlan(staffer.userId, 'trial', {
      name: oldTrial!.name,
      priceUsd: oldTrial!.priceUsd,
      description: oldTrial!.description,
      features: [...oldTrial!.features],
      modules: [...oldTrial!.modules],
      isPurchasable: oldTrial!.isPurchasable,
      stripePriceId: oldTrial!.stripePriceId,
      isTrialDefault: true,
      isFallbackDefault: oldTrial!.isFallbackDefault,
      sortOrder: oldTrial!.sortOrder,
    });
    expect(restored.ok).toBe(true);
  });

  it('cannot delete a default plan, or one an organization is on', async () => {
    const deleteDefault = await plan$.deletePlan(staffer.userId, 'starter');
    expect(deleteDefault.ok).toBe(false);
    if (!deleteDefault.ok) expect(deleteDefault.error.code).toBe('CONFLICT');

    const deleteInUse = await plan$.deletePlan(staffer.userId, 'trial');
    expect(deleteInUse.ok).toBe(false);
    // 'trial' is both a default AND (after the previous test's restore) in use —
    // either conflict reason is correct; what matters is it's refused.
    if (!deleteInUse.ok) expect(deleteInUse.error.code).toBe('CONFLICT');

    const missing = await plan$.deletePlan(staffer.userId, 'not-a-real-plan');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
  });

  it('deletes an unused, non-default plan', async () => {
    const deleted = await plan$.deletePlan(staffer.userId, newKey);
    expect(deleted.ok).toBe(true);

    const gone = await plan$.getPlan(newKey);
    expect(gone).toBeNull();
  });
});
