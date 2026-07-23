import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { RenewForm } from '@/features/membership/components/renew-form';
import { requireTenantContext } from '@/lib/session';
import { membershipService } from '@/lib/services';

export const metadata: Metadata = { title: 'Renewals' };

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function dueLabel(daysUntil: number): string {
  if (daysUntil < 0) return `expired ${Math.abs(daysUntil)}d ago`;
  if (daysUntil === 0) return 'expires today';
  return `in ${daysUntil}d`;
}

export default async function RenewalsPage() {
  const { ctx } = await requireTenantContext();
  const result = await membershipService().listRenewals(ctx);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const items = result.value;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/membership" className="text-sm text-muted-foreground hover:text-foreground">
          ← Membership
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Renewals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Active memberships expiring within 30 days, and those already lapsed. Renewing issues a
          receipt and extends the term automatically.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">Nothing due</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            No memberships are expiring soon. This queue fills as members approach their renewal
            date.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {items.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {m.memberName}
                  <Badge variant={m.state === 'overdue' ? 'destructive' : 'warning'}>
                    {dueLabel(m.daysUntil)}
                  </Badge>
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {m.planName}
                  {m.phone ? ` · ${m.phone}` : ''}
                  {m.email ? ` · ${m.email}` : ''} · until {formatDate(m.expiresOn)}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={cn('text-sm font-medium tabular-nums text-muted-foreground')}>
                  last {formatMoney(m.amount, m.currency)}
                </span>
                <RenewForm
                  subscriptionId={m.id}
                  currency={m.currency}
                  defaultAmount={m.amount}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
