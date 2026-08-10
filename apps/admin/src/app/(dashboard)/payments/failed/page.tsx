import type { Metadata } from 'next';
import { Alert, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { paymentService } from '@/lib/services';

export const metadata: Metadata = { title: 'Failed payments' };

const PROVIDER_LABELS: Record<string, string> = {
  razorpay: 'Razorpay',
  sslcommerz: 'SSLCommerz',
  stripe: 'Stripe',
};

export default async function FailedPaymentsPage() {
  const { ctx } = await requireTenantContext();
  const result = await paymentService().listRecentFailures(ctx);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const items = result.value;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Failed payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Devotee payment attempts that failed, were cancelled, or were abandoned mid-checkout
          (started over an hour ago, never completed). Nothing here was charged — follow up with
          the devotee if you'd like to help them try again.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No failed or abandoned payments</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Every recent checkout attempt either succeeded or is still in progress.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {items.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="font-medium">
                  {o.donorName}
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs uppercase text-muted-foreground">
                    {o.status === 'failed' ? 'Failed' : 'Abandoned'}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-sm text-muted-foreground">
                  {PROVIDER_LABELS[o.provider] ?? o.provider}
                  {o.categoryName ? ` · ${o.categoryName}` : ''} ·{' '}
                  {o.createdAt.toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {o.failureReason ? ` · ${o.failureReason}` : ''}
                  {o.email ? ` · ${o.email}` : ''}
                </div>
              </div>
              <div className="whitespace-nowrap font-semibold">{formatMoney(o.amount, o.currency)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
