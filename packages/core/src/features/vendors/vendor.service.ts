import type { Db } from '@templeos/db';
import {
  createBillSchema,
  recordBillPaymentSchema,
  vendorListQuerySchema,
  vendorSchema,
  voidBillSchema,
} from '@templeos/validators';
import {
  authorize,
  conflict,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import { csvField } from '../reports/report.service';
import { createVendorRepository } from './vendor.repository';
import type {
  BillPaymentStatus,
  BillSummary,
  PayablesStats,
  VendorDetail,
  VendorSummary,
} from './vendor.types';

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return domainError('VALIDATION', error.issues[0]?.message ?? 'Invalid input');
}

const paise = (v: string | number) => Math.round(Number(v) * 100);

export function createVendorService({ db }: { db: Db }) {
  const repo = createVendorRepository(db);

  const toVendor = (v: {
    id: string;
    name: string;
    category: string | null;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    taxId: string | null;
    note: string | null;
    isActive: boolean;
    outstanding: string;
    openBillCount: number;
  }): VendorSummary => ({
    id: v.id,
    name: v.name,
    category: v.category,
    contactPerson: v.contactPerson,
    phone: v.phone,
    email: v.email,
    address: v.address,
    taxId: v.taxId,
    note: v.note,
    isActive: v.isActive,
    outstanding: Number(v.outstanding).toFixed(2),
    openBillCount: v.openBillCount,
  });

  const toBill = (b: {
    id: string;
    vendorId: string;
    billNumber: string;
    description: string | null;
    amount: string;
    currency: 'INR' | 'BDT';
    billDate: string;
    dueDate: string | null;
    note: string | null;
    status: 'open' | 'void';
    voidReason: string | null;
    paid: string;
  }): BillSummary => {
    const amountPaise = paise(b.amount);
    const paidPaise = paise(b.paid);
    const outstandingPaise = Math.max(0, amountPaise - paidPaise);
    const paymentStatus: BillPaymentStatus =
      paidPaise <= 0 ? 'unpaid' : paidPaise >= amountPaise ? 'paid' : 'partial';
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: b.id,
      vendorId: b.vendorId,
      billNumber: b.billNumber,
      description: b.description,
      amount: Number(b.amount).toFixed(2),
      currency: b.currency,
      billDate: b.billDate,
      dueDate: b.dueDate,
      note: b.note,
      status: b.status,
      voidReason: b.voidReason,
      paid: Number(b.paid).toFixed(2),
      outstanding: (outstandingPaise / 100).toFixed(2),
      paymentStatus,
      isOverdue:
        b.status === 'open' && outstandingPaise > 0 && b.dueDate !== null && b.dueDate < today,
    };
  };

  return {
    async listVendors(ctx: TenantContext, rawQuery: unknown): Promise<Result<VendorSummary[]>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      const parsed = vendorListQuerySchema.safeParse(rawQuery ?? {});
      if (!parsed.success) return err(firstIssue(parsed.error));
      const rows = await repo.listVendors(ctx, {
        search: parsed.data.search ?? null,
        scope: parsed.data.scope,
      });
      return ok(rows.map(toVendor));
    },

    async getVendorDetail(ctx: TenantContext, vendorId: string): Promise<Result<VendorDetail>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      const vendor = await repo.findVendor(ctx, vendorId);
      if (!vendor) return err(notFound('Vendor'));
      const bills = await repo.listBills(ctx, vendorId);
      return ok({ vendor: toVendor(vendor), bills: bills.map(toBill) });
    },

    async getPayablesStats(ctx: TenantContext): Promise<Result<PayablesStats>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      return ok(await repo.payablesStats(ctx));
    },

    async createVendor(ctx: TenantContext, rawInput: unknown): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'expenses:write');
      if (!auth.ok) return auth;
      const parsed = vendorSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.createVendor(ctx, parsed.data);
      return ok({ id });
    },

    async updateVendor(
      ctx: TenantContext,
      vendorId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'expenses:write');
      if (!auth.ok) return auth;
      const parsed = vendorSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const id = await repo.updateVendor(ctx, vendorId, parsed.data);
      if (!id) return err(notFound('Vendor'));
      return ok({ id });
    },

    async setVendorActive(
      ctx: TenantContext,
      vendorId: string,
      isActive: boolean,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'expenses:write');
      if (!auth.ok) return auth;
      const id = await repo.setVendorActive(ctx, vendorId, isActive);
      if (!id) return err(notFound('Vendor'));
      return ok(null);
    },

    async createBill(
      ctx: TenantContext,
      vendorId: string,
      rawInput: unknown,
    ): Promise<Result<{ id: string }>> {
      const auth = authorize(ctx, 'expenses:write');
      if (!auth.ok) return auth;
      const parsed = createBillSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.createBill(ctx, vendorId, parsed.data);
      if (result.kind === 'no_vendor') return err(notFound('Vendor'));
      return ok({ id: result.id });
    },

    /** Records a payment against a bill as an expense voucher; returns its number. */
    async recordPayment(
      ctx: TenantContext,
      billId: string,
      rawInput: unknown,
    ): Promise<Result<{ voucherNumber: string }>> {
      const auth = authorize(ctx, 'expenses:write');
      if (!auth.ok) return auth;
      const parsed = recordBillPaymentSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.recordPayment(ctx, billId, parsed.data);
      if (result.kind === 'not_found') return err(notFound('Bill'));
      if (result.kind === 'void_bill') return err(conflict('This bill has been voided'));
      if (result.kind === 'overpay') {
        return err(
          domainError('VALIDATION', `Payment exceeds the ${result.outstanding} still outstanding`),
        );
      }
      return ok({ voucherNumber: result.voucherNumber });
    },

    async voidBill(
      ctx: TenantContext,
      billId: string,
      rawInput: unknown,
    ): Promise<Result<null>> {
      const auth = authorize(ctx, 'expenses:void');
      if (!auth.ok) return auth;
      const parsed = voidBillSchema.safeParse(rawInput);
      if (!parsed.success) return err(firstIssue(parsed.error));
      const result = await repo.voidBill(ctx, billId, parsed.data.reason);
      if (result.kind === 'not_found') return err(notFound('Bill'));
      if (result.kind === 'already_void') return err(conflict('This bill is already void'));
      if (result.kind === 'has_payments') {
        return err(conflict('This bill has payments recorded — void those vouchers first'));
      }
      return ok(null);
    },

    /** Accounts-payable register: every bill with its derived paid/outstanding. */
    async exportCsv(ctx: TenantContext): Promise<Result<string>> {
      const auth = authorize(ctx, 'expenses:read');
      if (!auth.ok) return auth;
      const rows = await repo.exportBillRows(ctx);
      const header = [
        'Vendor',
        'Bill No',
        'Description',
        'Bill Date',
        'Due Date',
        'Amount',
        'Paid',
        'Outstanding',
        'Currency',
        'Status',
      ].join(',');

      const lines = rows.map((r) => {
        const bill = toBill(r);
        return [
          csvField(r.vendorName),
          csvField(bill.billNumber),
          csvField(bill.description),
          csvField(bill.billDate),
          csvField(bill.dueDate),
          csvField(bill.amount),
          csvField(bill.paid),
          csvField(bill.outstanding),
          csvField(bill.currency),
          csvField(bill.status === 'void' ? 'void' : bill.paymentStatus),
        ].join(',');
      });

      return ok([header, ...lines].join('\r\n') + '\r\n');
    },
  };
}

export type VendorService = ReturnType<typeof createVendorService>;
