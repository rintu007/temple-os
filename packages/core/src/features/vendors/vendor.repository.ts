import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import {
  auditLogs,
  expenses,
  newId,
  organizations,
  vendorBills,
  vendors,
  withTenantContext,
  type Db,
} from '@templeos/db';
import type { CreateBillInput, RecordBillPaymentInput, VendorInput } from '@templeos/validators';
import {
  allocateVoucherNumber,
  findOrCreateExpenseCategory,
} from '../expenses/expense.repository';
import type { TenantContext } from '../../shared';

// Correlated-subquery fragments use raw identifiers rather than interpolated
// table objects — Drizzle's table interpolation mis-correlates the outer row
// inside a subquery, whereas raw column paths bind to the outer FROM cleanly.

/** Recorded (non-void) vouchers settled against a given bill — the paid-to-date total. */
const billPaidFor = (billCol: string) => sql<string>`coalesce((
  select sum(e.amount) from expenses e
  where e.vendor_bill_id = ${sql.raw(billCol)} and e.status = 'recorded'
), 0)::numeric(12, 2)`;

/** Outstanding across a vendor's open bills — correlates on the outer `vendors` row. */
const vendorOutstanding = sql<string>`coalesce((
  select sum(b.amount - coalesce((
    select sum(e.amount) from expenses e
    where e.vendor_bill_id = b.id and e.status = 'recorded'
  ), 0))
  from vendor_bills b
  where b.vendor_id = vendors.id and b.status = 'open'
), 0)::numeric(12, 2)`;

const vendorOpenBillCount = sql<number>`(
  select count(*)::int from vendor_bills b
  where b.vendor_id = vendors.id and b.status = 'open'
)`;

function vendorSearch(search: string | null): SQL | undefined {
  if (!search) return undefined;
  const term = `%${search}%`;
  return or(
    ilike(vendors.name, term),
    ilike(vendors.category, term),
    ilike(vendors.contactPerson, term),
    ilike(vendors.phone, term),
  );
}

export function createVendorRepository(db: Db) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const vendorColumns = {
    id: vendors.id,
    name: vendors.name,
    category: vendors.category,
    contactPerson: vendors.contactPerson,
    phone: vendors.phone,
    email: vendors.email,
    address: vendors.address,
    taxId: vendors.taxId,
    note: vendors.note,
    isActive: vendors.isActive,
    outstanding: vendorOutstanding,
    openBillCount: vendorOpenBillCount,
  };

  const billColumns = {
    id: vendorBills.id,
    vendorId: vendorBills.vendorId,
    billNumber: vendorBills.billNumber,
    description: vendorBills.description,
    amount: vendorBills.amount,
    currency: vendorBills.currency,
    billDate: vendorBills.billDate,
    dueDate: vendorBills.dueDate,
    note: vendorBills.note,
    status: vendorBills.status,
    voidReason: vendorBills.voidReason,
    paid: billPaidFor('vendor_bills.id'),
  };

  return {
    async listVendors(ctx: TenantContext, query: { search: string | null; scope: 'active' | 'all' }) {
      return withTenantContext(db, guc(ctx), (tx) => {
        const where = and(
          eq(vendors.organizationId, ctx.organizationId),
          query.scope === 'active' ? eq(vendors.isActive, true) : undefined,
          vendorSearch(query.search),
        );
        return tx
          .select(vendorColumns)
          .from(vendors)
          .where(where)
          .orderBy(desc(vendors.isActive), asc(vendors.name));
      });
    },

    async findVendor(ctx: TenantContext, vendorId: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .select(vendorColumns)
          .from(vendors)
          .where(eq(vendors.id, vendorId))
          .limit(1);
        return row ?? null;
      });
    },

    async createVendor(ctx: TenantContext, input: VendorInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .insert(vendors)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            name: input.name,
            category: input.category ?? null,
            contactPerson: input.contactPerson ?? null,
            phone: input.phone ?? null,
            email: input.email ?? null,
            address: input.address ?? null,
            taxId: input.taxId ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: vendors.id });
        if (!row) throw new Error('vendor insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'vendor.created',
          entityType: 'vendor',
          entityId: row.id,
          after: { name: input.name, category: input.category ?? null },
        });
        return row.id;
      });
    },

    async updateVendor(ctx: TenantContext, vendorId: string, input: VendorInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(vendors)
          .set({
            name: input.name,
            category: input.category ?? null,
            contactPerson: input.contactPerson ?? null,
            phone: input.phone ?? null,
            email: input.email ?? null,
            address: input.address ?? null,
            taxId: input.taxId ?? null,
            note: input.note ?? null,
          })
          .where(eq(vendors.id, vendorId))
          .returning({ id: vendors.id });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'vendor.updated',
          entityType: 'vendor',
          entityId: vendorId,
          after: { name: input.name },
        });
        return updated.id;
      });
    },

    async setVendorActive(ctx: TenantContext, vendorId: string, isActive: boolean) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [updated] = await tx
          .update(vendors)
          .set({ isActive })
          .where(eq(vendors.id, vendorId))
          .returning({ id: vendors.id, name: vendors.name });
        if (!updated) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: isActive ? 'vendor.reactivated' : 'vendor.deactivated',
          entityType: 'vendor',
          entityId: vendorId,
          after: { name: updated.name, isActive },
        });
        return updated.id;
      });
    },

    async listBills(ctx: TenantContext, vendorId: string) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select(billColumns)
          .from(vendorBills)
          .where(eq(vendorBills.vendorId, vendorId))
          .orderBy(desc(vendorBills.billDate), desc(vendorBills.createdAt)),
      );
    },

    async createBill(ctx: TenantContext, vendorId: string, input: CreateBillInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [vendor] = await tx
          .select({ id: vendors.id })
          .from(vendors)
          .where(eq(vendors.id, vendorId))
          .limit(1);
        if (!vendor) return { kind: 'no_vendor' as const };

        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const [bill] = await tx
          .insert(vendorBills)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            vendorId,
            billNumber: input.billNumber,
            description: input.description ?? null,
            amount: input.amount.toFixed(2),
            currency: org.currency,
            billDate: input.billDate,
            dueDate: input.dueDate ?? null,
            note: input.note ?? null,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: vendorBills.id });
        if (!bill) throw new Error('vendor bill insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'vendor_bill.created',
          entityType: 'vendor_bill',
          entityId: bill.id,
          after: { billNumber: input.billNumber, amount: input.amount.toFixed(2) },
        });
        return { kind: 'ok' as const, id: bill.id };
      });
    },

    /**
     * Settle (part of) a bill. Creates a real expense voucher linked back via
     * vendorBillId, so the payment lands in the books and the bill's paid/
     * outstanding figures stay derived from the ledger — never denormalized.
     */
    async recordPayment(ctx: TenantContext, billId: string, input: RecordBillPaymentInput) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [bill] = await tx
          .select({
            amount: vendorBills.amount,
            currency: vendorBills.currency,
            status: vendorBills.status,
            billNumber: vendorBills.billNumber,
            vendorId: vendorBills.vendorId,
            vendorName: vendors.name,
            vendorCategory: vendors.category,
          })
          .from(vendorBills)
          .innerJoin(vendors, eq(vendors.id, vendorBills.vendorId))
          .where(eq(vendorBills.id, billId))
          .limit(1);
        if (!bill) return { kind: 'not_found' as const };
        if (bill.status === 'void') return { kind: 'void_bill' as const };

        const [paidRow] = await tx
          .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)::numeric(12, 2)` })
          .from(expenses)
          .where(and(eq(expenses.vendorBillId, billId), eq(expenses.status, 'recorded')));

        const toPaise = (v: string | number) => Math.round(Number(v) * 100);
        const outstandingPaise = toPaise(bill.amount) - toPaise(paidRow?.total ?? '0');
        const payPaise = toPaise(input.amount);
        if (payPaise > outstandingPaise) {
          return { kind: 'overpay' as const, outstanding: (outstandingPaise / 100).toFixed(2) };
        }

        const spentAt = input.paidOn ? new Date(`${input.paidOn}T12:00:00`) : new Date();
        const voucherNumber = await allocateVoucherNumber(
          tx,
          ctx.organizationId,
          spentAt.getFullYear(),
        );
        const categoryId = bill.vendorCategory
          ? await findOrCreateExpenseCategory(tx, ctx.organizationId, bill.vendorCategory)
          : null;

        const [expense] = await tx
          .insert(expenses)
          .values({
            id: newId(),
            organizationId: ctx.organizationId,
            categoryId,
            vendorId: bill.vendorId,
            vendorBillId: billId,
            paidTo: bill.vendorName,
            amount: input.amount.toFixed(2),
            currency: bill.currency,
            method: input.method,
            reference: input.reference ?? null,
            note: input.note ?? `Payment for bill ${bill.billNumber}`,
            voucherNumber,
            spentAt,
            recordedByUserId: ctx.userId,
          })
          .returning({ id: expenses.id });
        if (!expense) throw new Error('payment voucher insert returned no row');

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'vendor_bill.payment',
          entityType: 'vendor_bill',
          entityId: billId,
          after: {
            voucherNumber,
            amount: input.amount.toFixed(2),
            billNumber: bill.billNumber,
          },
        });
        return { kind: 'ok' as const, voucherNumber, expenseId: expense.id };
      });
    },

    async voidBill(ctx: TenantContext, billId: string, reason: string) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [current] = await tx
          .select({ status: vendorBills.status, billNumber: vendorBills.billNumber })
          .from(vendorBills)
          .where(eq(vendorBills.id, billId))
          .limit(1);
        if (!current) return { kind: 'not_found' as const };
        if (current.status === 'void') return { kind: 'already_void' as const };

        const [paidRow] = await tx
          .select({ count: count() })
          .from(expenses)
          .where(and(eq(expenses.vendorBillId, billId), eq(expenses.status, 'recorded')));
        if ((paidRow?.count ?? 0) > 0) return { kind: 'has_payments' as const };

        await tx
          .update(vendorBills)
          .set({ status: 'void', voidReason: reason })
          .where(eq(vendorBills.id, billId));

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'vendor_bill.voided',
          entityType: 'vendor_bill',
          entityId: billId,
          after: { billNumber: current.billNumber, reason },
        });
        return { kind: 'ok' as const };
      });
    },

    async payablesStats(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), async (tx) => {
        const [org] = await tx
          .select({ currency: organizations.currency })
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId))
          .limit(1);
        if (!org) throw new Error('organization not visible in tenant context');

        const outstandingExpr = sql<string>`vendor_bills.amount - ${billPaidFor('vendor_bills.id')}`;
        const [row] = await tx
          .select({
            total: sql<string>`coalesce(sum(${outstandingExpr}), 0)::numeric(12, 2)`,
            overdue: sql<string>`coalesce(sum(${outstandingExpr}) filter (
              where ${vendorBills.dueDate} is not null and ${vendorBills.dueDate} < current_date
            ), 0)::numeric(12, 2)`,
            openBills: sql<number>`count(*) filter (where ${outstandingExpr} > 0)::int`,
          })
          .from(vendorBills)
          .where(
            and(eq(vendorBills.organizationId, ctx.organizationId), eq(vendorBills.status, 'open')),
          );

        const [vendorRow] = await tx
          .select({ count: count() })
          .from(vendors)
          .where(and(eq(vendors.organizationId, ctx.organizationId), eq(vendors.isActive, true)));

        return {
          currency: org.currency,
          totalOutstanding: row?.total ?? '0.00',
          overdueOutstanding: row?.overdue ?? '0.00',
          openBillCount: row?.openBills ?? 0,
          vendorCount: vendorRow?.count ?? 0,
        };
      });
    },

    /** All bills with derived paid/outstanding — AP register export. */
    async exportBillRows(ctx: TenantContext) {
      return withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select({ ...billColumns, vendorName: vendors.name })
          .from(vendorBills)
          .innerJoin(vendors, eq(vendors.id, vendorBills.vendorId))
          .where(eq(vendorBills.organizationId, ctx.organizationId))
          .orderBy(asc(vendors.name), desc(vendorBills.billDate)),
      );
    },
  };
}

export type VendorRepository = ReturnType<typeof createVendorRepository>;
