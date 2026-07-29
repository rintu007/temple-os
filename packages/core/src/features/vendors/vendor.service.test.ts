import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogs,
  createDb,
  domains,
  expenseCategories,
  expenseCounters,
  expenses,
  memberships,
  platformSubscriptions,
  organizations,
  roles,
  users,
  vendorBills,
  vendors,
} from '@templeos/db';
import { systemContext, type TenantContext } from '../../shared';
import { createOrganizationService } from '../organizations/organization.service';
import { createVendorService } from './vendor.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('vendors: accounts-payable ledger (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const orgService = createOrganizationService({ db, rootDomain: 'test.invalid' });
  const service = createVendorService({ db });

  const run = `ven${Date.now().toString(36)}`;
  const owner = { userId: randomUUID(), email: `own-${run}@test.invalid`, fullName: 'Owner' };
  let orgId = '';
  let ctx: TenantContext;
  let vendorId = '';
  let billId = '';

  afterAll(async () => {
    if (orgId) {
      const scope = [orgId];
      await admin.delete(auditLogs).where(inArray(auditLogs.organizationId, scope));
      await admin.delete(expenses).where(inArray(expenses.organizationId, scope));
      await admin.delete(vendorBills).where(inArray(vendorBills.organizationId, scope));
      await admin.delete(vendors).where(inArray(vendors.organizationId, scope));
      await admin.delete(expenseCategories).where(inArray(expenseCategories.organizationId, scope));
      await admin.delete(expenseCounters).where(inArray(expenseCounters.organizationId, scope));
      await admin.delete(memberships).where(inArray(memberships.organizationId, scope));
      await admin.delete(roles).where(inArray(roles.organizationId, scope));
      await admin.delete(domains).where(inArray(domains.organizationId, scope));
      await admin.delete(platformSubscriptions).where(inArray(platformSubscriptions.organizationId, scope));
      await admin.delete(organizations).where(inArray(organizations.id, scope));
    }
    await admin.delete(users).where(inArray(users.id, [owner.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('provisions an org and registers a vendor', async () => {
    const provisioned = await orgService.provisionOrganization(
      systemContext('vendor test'),
      { name: 'Vendor Org', slug: `${run}-main`, country: 'IN' },
      owner,
    );
    expect(provisioned.ok).toBe(true);
    if (provisioned.ok) orgId = provisioned.value.id;
    ctx = { organizationId: orgId, userId: owner.userId, roleKey: 'owner', templeIds: null };

    const created = await service.createVendor(ctx, {
      name: 'Sri Krishna Provisions',
      category: 'Prasadam supplies',
      phone: '9800000000',
    });
    expect(created.ok).toBe(true);
    if (created.ok) vendorId = created.value.id;
  });

  it('raises a bill and shows it as fully outstanding', async () => {
    const bill = await service.createBill(ctx, vendorId, {
      billNumber: 'INV-1001',
      amount: 5000,
      billDate: '2026-07-01',
      dueDate: '2026-07-10',
    });
    expect(bill.ok).toBe(true);
    if (bill.ok) billId = bill.value.id;

    const detail = await service.getVendorDetail(ctx, vendorId);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.value.vendor.outstanding).toBe('5000.00');
      expect(detail.value.vendor.openBillCount).toBe(1);
      const [b] = detail.value.bills;
      expect(b?.paymentStatus).toBe('unpaid');
      expect(b?.outstanding).toBe('5000.00');
      expect(b?.isOverdue).toBe(true); // due 2026-07-10, today 2026-07-25
    }
  });

  it('records a partial payment as a voucher and derives the balance', async () => {
    const pay = await service.recordPayment(ctx, billId, { amount: 2000, method: 'bank_transfer' });
    expect(pay.ok).toBe(true);
    if (pay.ok) expect(pay.value.voucherNumber).toMatch(/^EV2026-\d{5}$/);

    const detail = await service.getVendorDetail(ctx, vendorId);
    if (detail.ok) {
      const [b] = detail.value.bills;
      expect(b?.paid).toBe('2000.00');
      expect(b?.outstanding).toBe('3000.00');
      expect(b?.paymentStatus).toBe('partial');
      expect(detail.value.vendor.outstanding).toBe('3000.00');
    }
  });

  it('rejects overpayment beyond the outstanding balance', async () => {
    const over = await service.recordPayment(ctx, billId, { amount: 4000, method: 'cash' });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe('VALIDATION');
  });

  it('settling the remainder marks the bill paid', async () => {
    const pay = await service.recordPayment(ctx, billId, { amount: 3000, method: 'cash' });
    expect(pay.ok).toBe(true);

    const detail = await service.getVendorDetail(ctx, vendorId);
    if (detail.ok) {
      const [b] = detail.value.bills;
      expect(b?.paymentStatus).toBe('paid');
      expect(b?.outstanding).toBe('0.00');
      expect(b?.isOverdue).toBe(false);
      expect(detail.value.vendor.outstanding).toBe('0.00');
    }
  });

  it('refuses to void a bill that has payments', async () => {
    const voided = await service.voidBill(ctx, billId, { reason: 'entered twice' });
    expect(voided.ok).toBe(false);
    if (!voided.ok) expect(voided.error.code).toBe('CONFLICT');
  });

  it('voids an unpaid bill cleanly', async () => {
    const bill = await service.createBill(ctx, vendorId, {
      billNumber: 'INV-1002',
      amount: 750,
      billDate: '2026-07-05',
    });
    expect(bill.ok).toBe(true);
    if (bill.ok) {
      const voided = await service.voidBill(ctx, bill.value.id, { reason: 'duplicate' });
      expect(voided.ok).toBe(true);
    }
  });

  it('reports payables stats and exports the AP register', async () => {
    const stats = await service.getPayablesStats(ctx);
    expect(stats.ok).toBe(true);
    if (stats.ok) {
      expect(stats.value.totalOutstanding).toBe('0.00');
      expect(stats.value.vendorCount).toBe(1);
    }

    const csv = await service.exportCsv(ctx);
    expect(csv.ok).toBe(true);
    if (csv.ok) {
      expect(csv.value).toContain('Vendor,Bill No,Description,Bill Date,Due Date,Amount,Paid,Outstanding');
      expect(csv.value).toContain('Sri Krishna Provisions');
    }
  });

  it('a viewer can read but not write', async () => {
    const viewer: TenantContext = { ...ctx, roleKey: 'viewer' };
    const read = await service.listVendors(viewer, {});
    expect(read.ok).toBe(true);

    const write = await service.createVendor(viewer, { name: 'Nope Traders' });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe('FORBIDDEN');
  });
});
