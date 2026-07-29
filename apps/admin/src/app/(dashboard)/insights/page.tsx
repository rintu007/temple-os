import type { Metadata } from 'next';
import Link from 'next/link';
import type { NamedTotal, ReminderItem, ReminderKind } from '@templeos/core';
import { Alert, Badge, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { insightsService } from '@/lib/services';

export const metadata: Metadata = { title: 'Insights' };

const KIND_LABEL: Record<ReminderKind, string> = {
  pledge: 'Pledge',
  vendor_bill: 'Bill',
  loan: 'Loan',
  investment: 'Maturity',
  membership: 'Membership',
  recurring_expense: 'Recurring',
  recurring_donation: 'Recurring gift',
};

function hrefFor(r: ReminderItem): string {
  switch (r.kind) {
    case 'pledge':
      return `/pledges/${r.id}`;
    case 'loan':
      return `/loans/${r.id}`;
    case 'investment':
      return `/investments/${r.id}`;
    case 'recurring_expense':
      return `/recurring/${r.id}`;
    case 'recurring_donation':
      return `/donations/recurring/${r.id}`;
    case 'vendor_bill':
      return '/vendors';
    case 'membership':
      return '/membership';
  }
}

function BreakdownCard({
  title,
  rows,
  currency,
  empty,
}: {
  title: string;
  rows: NamedTotal[];
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  empty: string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, Number(r.total)), 0);
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{r.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatMoney(r.total, currency)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${max > 0 ? (Number(r.total) / max) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function InsightsPage() {
  const { ctx } = await requireTenantContext();
  const result = await insightsService().getInsights(ctx);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const s = result.value;
  const netNegative = Number(s.net) < 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What needs attention, and how the {s.financialYear} is tracking — all derived live from
          the ledger and registers.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card shadow-card p-5">
          <div className="text-sm text-muted-foreground">Income · {s.financialYear}</div>
          <div className="mt-1 text-2xl font-semibold text-success">
            {formatMoney(s.income, s.currency)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-card p-5">
          <div className="text-sm text-muted-foreground">Expenditure · {s.financialYear}</div>
          <div className="mt-1 text-2xl font-semibold text-destructive">
            {formatMoney(s.expenditure, s.currency)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-card p-5">
          <div className="text-sm text-muted-foreground">Net {netNegative ? 'deficit' : 'surplus'}</div>
          <div
            className={cn(
              'mt-1 text-2xl font-semibold tabular-nums',
              netNegative && 'text-destructive',
            )}
          >
            {formatMoney(s.net, s.currency)}
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          {s.reminderCounts.total > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              {s.reminderCounts.overdue > 0 ? (
                <Badge variant="destructive">{s.reminderCounts.overdue} overdue</Badge>
              ) : null}
              <span className="text-muted-foreground">{s.reminderCounts.total} in the next 30 days</span>
            </div>
          ) : null}
        </div>
        {s.reminders.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Nothing due in the next 30 days. Pledges, bills, loan and investment due dates, and
            membership renewals will surface here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {s.reminders.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <Link
                  href={hrefFor(r)}
                  className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/50"
                >
                  <Badge variant="outline" className="shrink-0">
                    {KIND_LABEL[r.kind]}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{r.title}</span>
                    {r.subtitle ? (
                      <span className="text-muted-foreground"> · {r.subtitle}</span>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-xs',
                      r.overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {r.overdue ? 'overdue · ' : ''}
                    {r.dueDate}
                  </span>
                  <span className="w-24 shrink-0 text-right font-medium tabular-nums">
                    {formatMoney(r.amount, s.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownCard
          title="Top donors"
          rows={s.topDonors}
          currency={s.currency}
          empty="No donations recorded this year yet."
        />
        <BreakdownCard
          title="Giving by category"
          rows={s.givingByCategory}
          currency={s.currency}
          empty="No donations recorded this year yet."
        />
        <BreakdownCard
          title="Biggest expenses"
          rows={s.topExpenseCategories}
          currency={s.currency}
          empty="No expenses recorded this year yet."
        />
      </div>
    </div>
  );
}
