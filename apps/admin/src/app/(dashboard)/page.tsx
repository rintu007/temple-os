import {
  ArrowUpRight,
  CalendarClock,
  CalendarPlus,
  ExternalLink,
  Flame,
  HandCoins,
  Landmark,
  ReceiptText,
  Scale,
  TrendingDown,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import type { UpcomingKind } from '@templeos/core';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
  formatMoney,
} from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { overviewService } from '@/lib/services';

function siteUrl(slug: string): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  return process.env.NODE_ENV === 'production'
    ? `https://${slug}.${root}`
    : `http://${slug}.${root}:3001`;
}

const QUICK_ACTIONS = [
  {
    href: '/donations/new',
    label: 'Record a donation',
    description: 'Cash, UPI or bank — receipt numbered automatically',
    icon: ReceiptText,
  },
  {
    href: '/devotees/new',
    label: 'Add a devotee',
    description: 'Grow your community directory',
    icon: UserPlus,
  },
  {
    href: '/events/new',
    label: 'Create an event',
    description: 'Festivals publish straight to your website',
    icon: CalendarPlus,
  },
] as const;

const SCHEDULE_META: Record<UpcomingKind, { label: string; variant: 'primary' | 'success' | 'warning' }> = {
  event: { label: 'Event', variant: 'primary' },
  puja: { label: 'Puja', variant: 'success' },
  facility: { label: 'Hall', variant: 'warning' },
};

function formatActivity(action: string): string {
  const words = action.replace(/[._]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Kolkata',
});
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

function scheduleDate(iso: string): string {
  // iso is 'YYYY-MM-DD' — render as a plain calendar date without TZ drift.
  const [y, m, d] = iso.split('-').map(Number);
  return dateFmt.format(new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12)));
}

export default async function DashboardPage() {
  const { membership, ctx } = await requireTenantContext();
  const result = await overviewService().getOverview(ctx);
  const publicUrl = siteUrl(membership.organizationSlug);
  const currency = result.ok ? result.value.currency : membership.currency;

  if (!result.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{membership.organizationName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We couldn&apos;t load your overview just now. Please refresh.
          </p>
        </div>
      </div>
    );
  }

  const o = result.value;
  const netPositive = Number.parseFloat(o.netThisMonth) >= 0;
  const maxTrend = Math.max(
    1,
    ...o.trend.map((t) =>
      Math.max(Number.parseFloat(t.donations), Number.parseFloat(t.expenses)),
    ),
  );

  const attentionItems = [
    {
      count: o.attention.pendingPujaBookings,
      label: 'puja bookings to confirm',
      href: '/pujas',
    },
    {
      count: o.attention.requestedFacilityBookings,
      label: 'hall requests to review',
      href: '/facilities/bookings',
    },
    {
      count: o.attention.membershipsDueRenewal,
      label: 'memberships due for renewal',
      href: '/membership/renewals',
    },
    {
      count: o.attention.openVolunteerOpportunities,
      label: 'open volunteer roles',
      href: '/volunteers',
    },
  ].filter((a) => a.count > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{membership.organizationName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s where things stand today.</p>
      </div>

      {attentionItems.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {attentionItems.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-3.5 py-1.5 text-sm font-medium text-warning transition-colors hover:bg-warning/15"
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-warning/20 text-xs font-semibold tabular-nums">
                {a.count}
              </span>
              {a.label}
              <ArrowUpRight className="size-3.5 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Donations this month"
          value={formatMoney(o.donations.monthTotal, currency)}
          hint={
            <>
              {o.donations.monthCount} receipt{o.donations.monthCount === 1 ? '' : 's'} ·{' '}
              <Link href="/donations" className="font-medium text-primary hover:underline">
                Ledger
              </Link>
            </>
          }
          icon={<HandCoins aria-hidden />}
        />
        <StatCard
          label="Expenses this month"
          value={formatMoney(o.expenses.monthTotal, currency)}
          hint={
            <>
              {o.expenses.monthCount} voucher{o.expenses.monthCount === 1 ? '' : 's'} ·{' '}
              <Link href="/expenses" className="font-medium text-primary hover:underline">
                Vouchers
              </Link>
            </>
          }
          icon={<TrendingDown aria-hidden />}
        />
        <StatCard
          label="Net this month"
          value={
            <span className={netPositive ? 'text-success' : 'text-destructive'}>
              {netPositive ? '' : '−'}
              {formatMoney(o.netThisMonth.replace('-', ''), currency)}
            </span>
          }
          hint={netPositive ? 'Income exceeds spending' : 'Spending exceeds income'}
          icon={<Scale aria-hidden />}
        />
        <StatCard
          label="Received all-time"
          value={formatMoney(o.donations.allTimeTotal, currency)}
          hint="Every recorded donation"
          icon={<Landmark aria-hidden />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Donations vs expenses</CardTitle>
            <span className="text-sm text-muted-foreground">Last 6 months</span>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-3 sm:gap-5">
              {o.trend.map((t) => {
                const dh = Math.round((Number.parseFloat(t.donations) / maxTrend) * 100);
                const eh = Math.round((Number.parseFloat(t.expenses) / maxTrend) * 100);
                return (
                  <div key={t.month} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-32 w-full items-end justify-center gap-1">
                      <div
                        className="w-1/2 max-w-5 rounded-t bg-primary transition-all"
                        style={{ height: `${Math.max(dh, 2)}%` }}
                        title={`Donations ${formatMoney(t.donations, currency)}`}
                      />
                      <div
                        className="w-1/2 max-w-5 rounded-t bg-muted-foreground/35 transition-all"
                        style={{ height: `${Math.max(eh, 2)}%` }}
                        title={`Expenses ${formatMoney(t.expenses, currency)}`}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{t.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-primary" /> Donations
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-muted-foreground/35" /> Expenses
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {QUICK_ACTIONS.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <ArrowUpRight
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
                  aria-hidden
                />
              </div>
              <div className="mt-3 text-sm font-semibold">{label}</div>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden /> Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            {o.schedule.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing scheduled yet. Confirm a puja, event or hall booking and it appears here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {o.schedule.map((s, i) => {
                  const meta = SCHEDULE_META[s.kind];
                  return (
                    <li key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="w-14 shrink-0 text-sm font-medium tabular-nums">
                        {scheduleDate(s.date)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{s.title}</div>
                        {s.subtitle ? (
                          <div className="truncate text-xs text-muted-foreground">{s.subtitle}</div>
                        ) : null}
                      </div>
                      {s.time ? (
                        <span className="text-xs tabular-nums text-muted-foreground">{s.time}</span>
                      ) : null}
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="size-4 text-muted-foreground" aria-hidden /> Active campaigns
            </CardTitle>
            <Link href="/campaigns" className="text-sm font-medium text-primary hover:underline">
              All
            </Link>
          </CardHeader>
          <CardContent>
            {o.campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active campaigns.{' '}
                <Link href="/campaigns" className="font-medium text-primary hover:underline">
                  Start a fundraiser
                </Link>{' '}
                to track progress toward a goal.
              </p>
            ) : (
              <ul className="space-y-4">
                {o.campaigns.map((c) => {
                  const goal = Number.parseFloat(c.goalAmount);
                  const raised = Number.parseFloat(c.raisedAmount);
                  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
                  return (
                    <li key={c.id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium">{c.title}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatMoney(c.raisedAmount, currency)} of {formatMoney(c.goalAmount, currency)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {o.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {o.activity.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="text-sm">{formatActivity(a.action)}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {dateTimeFmt.format(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Public website</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium break-all text-primary hover:underline"
            >
              {publicUrl.replace(/^https?:\/\//, '')}
              <ExternalLink className="size-4 shrink-0" aria-hidden />
            </a>
            <p className="text-sm text-muted-foreground">
              Schedules, events, pujas and donations — live for devotees.
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 text-sm">
              <div>
                <dt className="text-muted-foreground">Your role</dt>
                <dd className="mt-0.5 font-medium capitalize">{membership.roleName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Country</dt>
                <dd className="mt-0.5 font-medium">
                  {membership.country === 'IN' ? 'India' : 'Bangladesh'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Currency</dt>
                <dd className="mt-0.5 font-medium">{membership.currency}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Online payments</dt>
                <dd className="mt-0.5 font-medium">
                  {membership.currency === 'INR' ? 'Razorpay' : 'SSLCommerz'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
