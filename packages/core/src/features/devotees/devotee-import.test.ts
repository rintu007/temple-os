import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  devotees,
  domains,
  families,
  memberships,
  organizations,
  roles,
  users,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createDevoteeService } from './devotee.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('devotees: CSV import (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createDevoteeService({ db });

  const run = `imp${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';

  const ctx = (): TenantContext => ({
    organizationId: orgId,
    userId: owner.userId,
    roleKey: 'owner',
    templeIds: null,
  });

  afterAll(async () => {
    if (orgId) {
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, [orgId]));
      await admin.delete(devotees).where(inArray(devotees.organizationId, [orgId]));
      await admin.delete(families).where(inArray(families.organizationId, [orgId]));
      await admin.delete(memberships).where(inArray(memberships.organizationId, [orgId]));
      await admin.delete(roles).where(inArray(roles.organizationId, [orgId]));
      await admin.delete(domains).where(inArray(domains.organizationId, [orgId]));
      await admin.delete(organizations).where(inArray(organizations.id, [orgId]));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up organization with one existing devotee', async () => {
    const a = await orgService.provisionOrganization(
      systemContext('import test'),
      { name: 'Import Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(a.ok).toBe(true);
    if (a.ok) orgId = a.value.id;

    const existing = await service.createDevotee(ctx(), {
      fullName: 'Existing Devotee',
      phone: '9999900000',
    });
    expect(existing.ok).toBe(true);
  });

  it('imports valid rows, skips duplicates, reports bad rows with line numbers', async () => {
    const csv = [
      'Name,Mobile,Email,Family,City,DOB',
      'Anita Roy,9876543210,anita@example.com,Roy Family,Kolkata,15/08/1975',
      'Ravi Roy,9876543211,,Roy Family,Kolkata,',
      'Existing Devotee,9999900000,,,,', // duplicate phone → skipped
      'X,,,,,', // name too short → row error
      '"Sen, Mita",9876543212,mita@example.com,,Howrah,',
    ].join('\n');

    const result = await service.importDevoteesFromCsv(ctx(), csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.imported).toBe(3);
    expect(result.value.duplicates).toBe(1);
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0]?.line).toBe(5);

    // Roy Family created once and shared by both Roys
    const list = await service.listDevotees(ctx(), { search: 'roy' });
    expect(list.ok).toBe(true);
    if (list.ok) {
      const roys = list.value.items.filter((d) => d.familyName === 'Roy Family');
      expect(roys).toHaveLength(2);
      expect(new Set(roys.map((r) => r.familyId)).size).toBe(1);
    }

    // Quoted name with comma survived intact
    const mita = await service.listDevotees(ctx(), { search: 'Sen, Mita' });
    if (mita.ok) expect(mita.value.total).toBe(1);
  });

  it('re-importing the same file is a no-op (all duplicates by phone/email)', async () => {
    const csv = 'name,phone\nAnita Roy,9876543210\nRavi Roy,9876543211\n';
    const result = await service.importDevoteesFromCsv(ctx(), csv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.imported).toBe(0);
      expect(result.value.duplicates).toBe(2);
    }
  });

  it('viewer cannot import', async () => {
    const denied = await service.importDevoteesFromCsv(
      { ...ctx(), roleKey: 'viewer' },
      'name\nSomeone\n',
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');
  });
});
