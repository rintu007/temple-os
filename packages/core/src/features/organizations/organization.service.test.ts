import { randomUUID } from 'node:crypto';
import { inArray, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  memberships,
  organizations,
  roles,
  users,
  withTenantContext,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from './organization.service';

/**
 * Live tenant-isolation suite. Runs the real provisioning flow against the
 * database as the RLS-enforced runtime role, then attempts cross-tenant reads.
 * Skipped when DATABASE_URL / DATABASE_URL_ADMIN are absent (e.g. CI without
 * a database); the admin connection is used only for cleanup.
 */
const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('organizations: provisioning + tenant isolation (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const rootDomain = 'test.invalid'; // never a real site
  const service = createOrganizationService({ db, rootDomain });

  const run = Date.now().toString(36);
  const ownerA = { userId: randomUUID(), email: `owner-a-${run}@test.invalid`, fullName: 'Owner A' };
  const ownerB = { userId: randomUUID(), email: `owner-b-${run}@test.invalid`, fullName: 'Owner B' };
  const slugA = `iso-${run}-a`;
  const slugB = `iso-${run}-b`;
  const ctx = systemContext('vitest tenancy suite');
  let orgAId = '';
  let orgBId = '';

  afterAll(async () => {
    const orgIds = [orgAId, orgBId].filter(Boolean);
    if (orgIds.length > 0) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, orgIds));
      await admin.delete(memberships).where(inArray(memberships.organizationId, orgIds));
      await admin.delete(roles).where(inArray(roles.organizationId, orgIds));
      await admin.delete(domains).where(inArray(domains.organizationId, orgIds));
      await admin.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    await admin.delete(users).where(inArray(users.id, [ownerA.userId, ownerB.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions two organizations as the RLS-enforced role', async () => {
    const a = await service.provisionOrganization(
      ctx,
      { name: 'Temple A', slug: slugA, country: 'IN' },
      ownerA,
    );
    expect(a.ok).toBe(true);
    if (a.ok) {
      orgAId = a.value.id;
      expect(a.value.currency).toBe('INR');
      expect(a.value.status).toBe('active');
    }

    const b = await service.provisionOrganization(
      ctx,
      { name: 'Temple B', slug: slugB, country: 'BD' },
      ownerB,
    );
    expect(b.ok).toBe(true);
    if (b.ok) {
      orgBId = b.value.id;
      expect(b.value.currency).toBe('BDT');
    }
  });

  it('rejects a duplicate slug', async () => {
    const dup = await service.provisionOrganization(
      ctx,
      { name: 'Copycat', slug: slugA, country: 'IN' },
      { userId: randomUUID(), email: `dup-${run}@test.invalid` },
    );
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('CONFLICT');
  });

  it('owner sees their membership and organization', async () => {
    const mems = await service.listUserMemberships(ownerA.userId);
    expect(mems).toHaveLength(1);
    expect(mems[0]?.organizationId).toBe(orgAId);
    expect(mems[0]?.roleKey).toBe('owner');

    const tenantCtx: TenantContext = {
      organizationId: orgAId,
      userId: ownerA.userId,
      roleKey: 'owner',
      templeIds: null,
    };
    const org = await service.getOrganization(tenantCtx);
    expect(org.ok).toBe(true);
    if (org.ok) expect(org.value.name).toBe('Temple A');
  });

  it('tenant B cannot see tenant A data (organizations, memberships, roles, audit)', async () => {
    await withTenantContext(
      db,
      { organizationId: orgBId, userId: ownerB.userId },
      async (tx) => {
        const orgRows = await tx.select().from(organizations).where(eq(organizations.id, orgAId));
        expect(orgRows).toHaveLength(0);

        const memRows = await tx
          .select()
          .from(memberships)
          .where(eq(memberships.organizationId, orgAId));
        expect(memRows).toHaveLength(0);

        const roleRows = await tx.select().from(roles).where(eq(roles.organizationId, orgAId));
        expect(roleRows).toHaveLength(0);

        const auditRows = await tx
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.organizationId, orgAId));
        expect(auditRows).toHaveLength(0);

        const userRows = await tx.select().from(users).where(eq(users.id, ownerA.userId));
        expect(userRows).toHaveLength(0);
      },
    );
  });

  it('user B membership listing never includes org A', async () => {
    const mems = await service.listUserMemberships(ownerB.userId);
    expect(mems).toHaveLength(1);
    expect(mems[0]?.organizationId).toBe(orgBId);
  });

  it('resolves a public site by hostname, unknown hostnames return null', async () => {
    const site = await service.resolveSiteByHostname(`${slugA}.${rootDomain}`);
    expect(site?.organizationId).toBe(orgAId);
    expect(site?.name).toBe('Temple A');

    const missing = await service.resolveSiteByHostname(`nope-${run}.${rootDomain}`);
    expect(missing).toBeNull();
  });

  it('slug availability reflects reality', async () => {
    expect(await service.isSlugAvailable(ctx, slugA)).toBe(false);
    expect(await service.isSlugAvailable(ctx, `free-${run}`)).toBe(true);
  });
});
