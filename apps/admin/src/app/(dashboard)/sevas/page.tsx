import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { sevaService } from '@/lib/services';

export const metadata: Metadata = { title: 'Sevas' };

interface SevasPageProps {
  searchParams: Promise<{ scope?: string }>;
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

const STATUS_VARIANT: Record<string, 'outline'> = { paused: 'outline', ended: 'outline' };

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function SevasPage({ searchParams }: SevasPageProps) {
  const { scope } = await searchParams;
  const { ctx } = await requireTenantContext('worship');
  const showAll = scope === 'all';

  const [result, stats] = await Promise.all([
    sevaService().listSevas(ctx, { scope: showAll ? 'all' : 'active' }),
    sevaService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const sevas = result.value;
  const currency = stats.ok ? stats.value.currency : 'INR';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sevas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Standing worship sponsorships — daily archana, monthly abhishekam, annual nakshatra
            sevas. Collection is derived from the receipts tagged to each seva.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/sevas/export.csv"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <Link
            href="/sevas/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Add seva
          </Link>
        </div>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Value per cycle</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.perCycleValue, currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Active sevas</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.activeCount}</div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Link
          href={showAll ? '/sevas' : '/sevas?scope=all'}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? 'Active only' : 'Show paused/ended too'}
        </Link>
      </div>

      {sevas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No sevas yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Register a standing seva sponsorship, then record each payment as it comes in.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {sevas.map((s) => (
            <li key={s.id}>
              <Link
                href={`/sevas/${s.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  s.status !== 'active' && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {s.sevaName}
                    <Badge variant="outline">{FREQ_LABELS[s.frequency] ?? s.frequency}</Badge>
                    {s.status !== 'active' ? (
                      <Badge variant={STATUS_VARIANT[s.status] ?? 'outline'} className="capitalize">
                        {s.status}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {s.sponsorName}
                    {s.occasion ? ` · ${s.occasion}` : ''}
                    {' · '}
                    {formatMoney(s.amount, currency)}/cycle
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {s.nextOccurrence ? (
                    <>
                      <div className="text-sm font-medium whitespace-nowrap">
                        {formatDate(s.nextOccurrence)}
                      </div>
                      <div className="text-xs text-muted-foreground">next occurrence</div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold whitespace-nowrap tabular-nums">
                        {formatMoney(s.collected, currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">collected</div>
                    </>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
