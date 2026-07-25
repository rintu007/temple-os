import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { BillSummary } from '@templeos/core';
import { Badge, Button, cn, formatMoney } from '@templeos/ui';
import {
  createBillAction,
  recordPaymentAction,
  setVendorActiveAction,
  updateVendorAction,
  voidBillAction,
} from '@/features/vendors/actions';
import { BillForm } from '@/features/vendors/components/bill-form';
import { PaymentForm } from '@/features/vendors/components/payment-form';
import { VendorForm } from '@/features/vendors/components/vendor-form';
import { requireTenantContext } from '@/lib/session';
import { vendorService } from '@/lib/services';

interface VendorDetailProps {
  params: Promise<{ vendorId: string }>;
}

export const metadata: Metadata = { title: 'Vendor' };

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ bill }: { bill: BillSummary }) {
  if (bill.status === 'void') return <Badge variant="outline">Void</Badge>;
  if (bill.isOverdue) return <Badge variant="destructive">Overdue</Badge>;
  if (bill.paymentStatus === 'paid') return <Badge variant="success">Paid</Badge>;
  if (bill.paymentStatus === 'partial') return <Badge variant="warning">Partial</Badge>;
  return <Badge variant="outline">Unpaid</Badge>;
}

export default async function VendorDetailPage({ params }: VendorDetailProps) {
  const { vendorId } = await params;
  const { ctx } = await requireTenantContext();

  const result = await vendorService().getVendorDetail(ctx, vendorId);
  if (!result.ok) notFound();
  const { vendor, bills } = result.value;
  const currency = bills[0]?.currency ?? 'INR';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/vendors" className="text-sm text-muted-foreground hover:text-foreground">
          ← Vendors
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{vendor.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {vendor.category ?? 'Vendor'}
              {vendor.isActive ? '' : ' · inactive'}
            </p>
          </div>
          {Number(vendor.outstanding) > 0 ? (
            <div className="text-right">
              <div className="text-xl font-semibold">
                {formatMoney(vendor.outstanding, currency)}
              </div>
              <div className="text-xs text-muted-foreground">outstanding</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Bills */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Bills</h2>
          <span className="text-xs text-muted-foreground">
            {bills.length} bill{bills.length === 1 ? '' : 's'}
          </span>
        </div>

        {bills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bills recorded for this vendor yet.</p>
        ) : (
          <ul className="space-y-3">
            {bills.map((b) => {
              const settleable = b.status === 'open' && Number(b.outstanding) > 0;
              return (
                <li
                  key={b.id}
                  className={cn(
                    'rounded-lg border border-border p-4',
                    b.status === 'void' && 'opacity-60',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-medium">
                        {b.billNumber}
                        <StatusBadge bill={b} />
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {b.description ? `${b.description} · ` : ''}
                        {formatDate(b.billDate)}
                        {b.dueDate ? ` · due ${formatDate(b.dueDate)}` : ''}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-semibold">{formatMoney(b.amount, b.currency)}</div>
                      {b.status !== 'void' && Number(b.paid) > 0 ? (
                        <div className="text-xs text-muted-foreground">
                          {formatMoney(b.paid, b.currency)} paid ·{' '}
                          {formatMoney(b.outstanding, b.currency)} due
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {settleable ? (
                    <details className="group mt-3">
                      <summary className="cursor-pointer list-none text-sm font-medium text-primary hover:underline">
                        Record payment
                      </summary>
                      <div className="mt-3">
                        <PaymentForm
                          action={recordPaymentAction.bind(null, vendorId, b.id)}
                          outstanding={b.outstanding}
                        />
                      </div>
                    </details>
                  ) : null}

                  {b.status === 'open' && Number(b.paid) === 0 ? (
                    <form
                      action={voidBillAction.bind(null, vendorId, b.id)}
                      className="mt-3 border-t border-border pt-3"
                    >
                      <button
                        type="submit"
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Void this bill
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <details className="mt-5">
          <summary className="cursor-pointer list-none text-sm font-medium text-primary hover:underline">
            + Add a bill
          </summary>
          <div className="mt-4">
            <BillForm action={createBillAction.bind(null, vendorId)} />
          </div>
        </details>
      </section>

      {/* Vendor details */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Vendor details</h2>
        <VendorForm
          action={updateVendorAction.bind(null, vendorId)}
          vendor={vendor}
          submitLabel="Save changes"
        />
      </section>

      {/* Status */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-medium text-muted-foreground">
          {vendor.isActive ? 'Deactivate vendor' : 'Reactivate vendor'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {vendor.isActive
            ? 'Hide this vendor from the active list. Their bills and history are kept.'
            : 'Return this vendor to the active list.'}
        </p>
        <form
          action={setVendorActiveAction.bind(null, vendorId, !vendor.isActive)}
          className="mt-4"
        >
          <Button variant={vendor.isActive ? 'destructive' : 'outline'} size="sm" type="submit">
            {vendor.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </form>
      </section>
    </div>
  );
}
