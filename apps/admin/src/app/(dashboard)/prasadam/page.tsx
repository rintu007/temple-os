import type { Metadata } from 'next';
import Link from 'next/link';
import { MEAL_LABELS, type PrasadamMeal } from '@templeos/validators';
import { Alert, Badge, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { prasadamService } from '@/lib/services';

export const metadata: Metadata = { title: 'Annadanam' };

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function PrasadamPage() {
  const { ctx } = await requireTenantContext();
  const [result, stats] = await Promise.all([
    prasadamService().listSessions(ctx),
    prasadamService().getStats(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const sessions = result.value;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Annadanam &amp; Prasadam</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log daily free-meal and prasadam distribution, with optional sponsorship.
          </p>
        </div>
        <Link
          href="/prasadam/new"
          className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
        >
          Record serving
        </Link>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">Served today</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.value.todayMeals}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">Served this month</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.value.monthMeals}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">Sessions this month</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {stats.value.monthSessions}
            </div>
          </div>
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No servings logged yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Record your first annadanam or prasadam serving to start tracking distribution.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {MEAL_LABELS[s.meal as PrasadamMeal] ?? s.meal}
                  <Badge variant="default">{s.servedCount} served</Badge>
                  {s.sponsorReceiptNumber ? (
                    <Badge variant="success">sponsored</Badge>
                  ) : null}
                </div>
                <div className="mt-0.5 truncate text-sm text-muted-foreground">
                  {formatDate(s.servedOn)}
                  {s.sponsorName ? ` · by ${s.sponsorName}` : ''}
                  {s.note ? ` · ${s.note}` : ''}
                </div>
              </div>
              {s.sponsorAmount && s.currency ? (
                <div className="text-right whitespace-nowrap">
                  <div className="font-semibold">{formatMoney(s.sponsorAmount, s.currency)}</div>
                  <div className="text-xs text-muted-foreground">{s.sponsorReceiptNumber}</div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
