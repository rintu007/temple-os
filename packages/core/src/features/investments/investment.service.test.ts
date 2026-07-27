import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  investments,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createInvestmentService } from './investment.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('investments: principal/maturity/interest (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const inv$ = createInvestmentService({ db });

  const run = `inv${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let fdId = '';

  afterAll(async () => {
    if (orgId) {
      const s = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, s));
      await admin.delete(investments).where(inArray(investments.organizationId, s));
      await admin.delete(memberships).where(inArray(memberships.organizationId, s));
      await admin.delete(roles).where(inArray(roles.organizationId, s));
      await admin.delete(domains).where(inArray(domains.organizationId, s));
      await admin.delete(organizations).where(inArray(organizations.id, s));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and records a fixed deposit', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('investment test'),
      { name: 'Investment Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await inv$.createInvestment(ctx, {
      institution: 'State Bank of India',
      type: 'fixed_deposit',
      reference: 'FD-88213',
      principal: 100000,
      interestRate: 7.1,
      investedOn: '2026-04-01',
      maturityDate: '2027-04-01',
      maturityValue: 121000,
    });
    expect(created.ok).toBe(true);
    if (created.ok) fdId = created.value.id;
  });

  it('derives interest earned from maturity value − principal', async () => {
    const detail = await inv$.getInvestment(ctx, fdId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.principal).toBe('100000.00');
    expect(detail.value.maturityValue).toBe('121000.00');
    expect(detail.value.interestEarned).toBe('21000.00');
  });

  it('rejects a maturity value below the principal', async () => {
    const bad = await inv$.createInvestment(ctx, {
      institution: 'X Bank',
      type: 'fixed_deposit',
      principal: 50000,
      investedOn: '2026-04-01',
      maturityValue: 40000,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALIDATION');
  });

  it('aggregates invested, maturity value and expected interest in stats', async () => {
    await inv$.createInvestment(ctx, {
      institution: 'Post Office',
      type: 'recurring_deposit',
      principal: 60000,
      investedOn: '2026-05-01',
      // no maturity value stated → falls back to principal
    });

    const stats = await inv$.getStats(ctx);
    expect(stats.ok).toBe(true);
    if (!stats.ok) return;
    expect(stats.value.totalInvested).toBe('160000.00'); // 100000 + 60000
    expect(stats.value.totalMaturityValue).toBe('181000.00'); // 121000 + 60000 fallback
    expect(stats.value.expectedInterest).toBe('21000.00'); // 181000 − 160000
    expect(stats.value.activeCount).toBe(2);
  });

  it('matures a holding and hides it from the active scope', async () => {
    const matured = await inv$.setInvestmentStatus(ctx, fdId, 'matured');
    expect(matured.ok).toBe(true);
    const active = await inv$.listInvestments(ctx, { scope: 'active' });
    if (active.ok) expect(active.value.find((x) => x.id === fdId)).toBeUndefined();
    const all = await inv$.listInvestments(ctx, { scope: 'all' });
    if (all.ok) expect(all.value.find((x) => x.id === fdId)).toBeDefined();
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await inv$.listInvestments(viewer, { scope: 'all' });
    expect(read.ok).toBe(true);

    const write = await inv$.createInvestment(viewer, {
      institution: 'X',
      type: 'other',
      principal: 1,
      investedOn: '2026-01-01',
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
