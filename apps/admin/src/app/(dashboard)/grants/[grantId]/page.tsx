import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { GrantLedgerEntry } from '@templeos/core';
import { Badge, Button, formatMoney } from '@templeos/ui';
import { setGrantStatusAction, updateGrantAction } from '@/features/grants/actions';
import { GrantForm } from '@/features/grants/components/grant-form';
import { requireTenantContext } from '@/lib/session';
import { grantService } from '@/lib/services';

interface GrantDetailProps {
  params: Promise<{ grantId: string }>;
}

export const metadata: Metadata = { title: 'Grant' };

function EntryList({
  title,
  entries,
  currency,
  empty,
}: {
  title: string;
  entries: GrantLedgerEntry[];
  currency: 'INR' | 'BDT';
  empty: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{e.ref}</span>
                <span className="text-muted-foreground"> · {e.party}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {e.at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="font-medium tabular-nums">{formatMoney(e.amount, currency)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function GrantDetailPage({ params }: GrantDetailProps) {
  const { grantId } = await params;
  const { ctx, membership } = await requireTenantContext();

  const result = await grantService().getGrantDetail(ctx, grantId);
  if (!result.ok) notFound();
  const { grant, currency, receipts, utilizations } = result.value;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/grants" className="text-sm text-muted-foreground hover:text-foreground">
          ← Grants
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {grant.title}
              {grant.status === 'closed' ? <Badge variant="outline">Closed</Badge> : null}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {grant.funder}
              {grant.reference ? ` · ${grant.reference}` : ''}
              {grant.purpose ? ` · ${grant.purpose}` : ''}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">
              {formatMoney(grant.unspent, currency)}
            </div>
            <div className="text-xs text-muted-foreground">unspent</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Sanctioned', value: grant.sanctionedAmount },
          { label: 'Received', value: grant.received },
          { label: 'Utilized', value: grant.utilized },
          { label: 'Pending release', value: grant.pendingRelease },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card shadow-card p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="mt-0.5 font-semibold tabular-nums">{formatMoney(s.value, currency)}</div>
          </div>
        ))}
      </div>

      <section className="grid gap-6 rounded-xl border border-border bg-card p-6 shadow-card md:grid-cols-2">
        <EntryList
          title="Releases received"
          entries={receipts}
          currency={currency}
          empty="No grant money received yet."
        />
        <EntryList
          title="Utilizations"
          entries={utilizations}
          currency={currency}
          empty="Nothing utilized from this grant yet."
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Grant details</h2>
        <GrantForm
          action={updateGrantAction.bind(null, grantId)}
          grant={grant}
          currency={membership.currency}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-medium text-muted-foreground">
          {grant.status === 'active' ? 'Close grant' : 'Reopen grant'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {grant.status === 'active'
            ? 'Mark this grant as fully accounted for. It leaves the tagging dropdowns; history is kept.'
            : 'Return this grant to the active list and tagging dropdowns.'}
        </p>
        <form
          action={setGrantStatusAction.bind(
            null,
            grantId,
            grant.status === 'active' ? 'closed' : 'active',
          )}
          className="mt-4"
        >
          <Button
            variant={grant.status === 'active' ? 'destructive' : 'outline'}
            size="sm"
            type="submit"
          >
            {grant.status === 'active' ? 'Close grant' : 'Reopen grant'}
          </Button>
        </form>
      </section>
    </div>
  );
}
