import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { membershipService } from '@/lib/services';

export const metadata: Metadata = { title: 'Membership' };

function durationLabel(months: number): string {
  if (months === 12) return 'per year';
  if (months === 1) return 'per month';
  if (months % 12 === 0) return `for ${months / 12} years`;
  return `for ${months} months`;
}

export default async function MembershipPage() {
  const { ctx } = await requireTenantContext();
  const result = await membershipService().listPlans(ctx);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const plans = result.value;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Membership</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plans devotees can join and pay for on your website.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/membership/members"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            View members
          </Link>
          <Link
            href="/membership/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Add plan
          </Link>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No membership plans yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create a plan — devotees join and pay online, and appear in your member roster.
          </p>
          <Link
            href="/membership/new"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Add your first plan →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {plans.map((p) => (
            <li key={p.id}>
              <Link
                href={`/membership/${p.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  !p.isActive && 'opacity-50',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {p.name}
                    {!p.isActive ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs uppercase text-muted-foreground">
                        Hidden
                      </span>
                    ) : null}
                  </div>
                  {p.description ? (
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {p.description}
                    </div>
                  ) : null}
                </div>
                <span className="whitespace-nowrap text-right">
                  <span className="font-semibold">{formatMoney(p.price, p.currency)}</span>{' '}
                  <span className="text-sm text-muted-foreground">
                    {durationLabel(p.durationMonths)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
