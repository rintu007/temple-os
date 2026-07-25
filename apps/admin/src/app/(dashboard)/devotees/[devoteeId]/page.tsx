import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, formatMoney } from '@templeos/ui';
import { archiveDevoteeAction, updateDevoteeAction } from '@/features/devotees/actions';
import { DevoteeForm } from '@/features/devotees/components/devotee-form';
import { requireTenantContext } from '@/lib/session';
import { devoteeService, donationService } from '@/lib/services';

interface DevoteeDetailProps {
  params: Promise<{ devoteeId: string }>;
}

export const metadata: Metadata = { title: 'Devotee' };

export default async function DevoteeDetailPage({ params }: DevoteeDetailProps) {
  const { devoteeId } = await params;
  const { ctx } = await requireTenantContext();

  const [devotee, giving] = await Promise.all([
    devoteeService().getDevotee(ctx, devoteeId),
    donationService().getDevoteeGiving(ctx, devoteeId),
  ]);
  if (!devotee.ok) notFound();
  const g = giving.ok ? giving.value : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/devotees" className="text-sm text-muted-foreground hover:text-foreground">
          ← Devotees
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{devotee.value.fullName}</h1>
      </div>

      {g ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Giving</h2>
            {g.lifetimeCount > 0 ? (
              <Link
                href={`/devotees/${devoteeId}/statement`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Print annual statement →
              </Link>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <div className="text-sm text-muted-foreground">Lifetime</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {formatMoney(g.lifetimeTotal, g.currency)}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {g.lifetimeCount} receipt{g.lifetimeCount === 1 ? '' : 's'}
              </div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-sm text-muted-foreground">This year (FY {g.fyLabel})</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {formatMoney(g.fyTotal, g.currency)}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {g.fyCount} receipt{g.fyCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          {g.recent.length > 0 ? (
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {g.recent.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/donations/${d.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm hover:bg-muted/50"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{d.receiptNumber}</span>
                      <span className="text-muted-foreground">
                        {' · '}
                        {d.donatedAt.toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {d.categoryName ? ` · ${d.categoryName}` : ''}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums whitespace-nowrap">
                      {formatMoney(d.amount, d.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No donations recorded for this devotee yet.
            </p>
          )}
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Profile</h2>
        <DevoteeForm
          action={updateDevoteeAction.bind(null, devoteeId)}
          devotee={devotee.value}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="text-sm font-medium text-muted-foreground">Archive</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Removes this devotee from the active directory. Their history is kept and they can be
          restored later.
        </p>
        <form action={archiveDevoteeAction.bind(null, devoteeId)} className="mt-4">
          <Button variant="destructive" size="sm" type="submit">
            Archive devotee
          </Button>
        </form>
      </section>
    </div>
  );
}
