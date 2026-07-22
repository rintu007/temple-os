import {
  ArrowUpRight,
  CalendarPlus,
  ExternalLink,
  HandCoins,
  Landmark,
  ReceiptText,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
  formatMoney,
} from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { donationService, templeService } from '@/lib/services';

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

export default async function DashboardPage() {
  const { membership, ctx } = await requireTenantContext();
  const [temples, donationStats] = await Promise.all([
    templeService().listTemples(ctx),
    donationService().getStats(ctx),
  ]);
  const templeCount = temples.ok ? temples.value.length : 0;
  const publicUrl = siteUrl(membership.organizationSlug);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{membership.organizationName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s where things stand today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Donations this month"
          value={
            donationStats.ok
              ? formatMoney(donationStats.value.monthTotal, donationStats.value.currency)
              : '—'
          }
          hint={
            donationStats.ok ? (
              <>
                {donationStats.value.monthCount} receipt
                {donationStats.value.monthCount === 1 ? '' : 's'} ·{' '}
                <Link href="/donations" className="font-medium text-primary hover:underline">
                  View ledger
                </Link>
              </>
            ) : undefined
          }
          icon={<HandCoins aria-hidden />}
        />
        <StatCard
          label="Temples"
          value={templeCount}
          hint={
            <Link
              href={templeCount === 0 ? '/temples/new' : '/temples'}
              className="font-medium text-primary hover:underline"
            >
              {templeCount === 0 ? 'Add your first temple' : 'Manage temples'}
            </Link>
          }
          icon={<Landmark aria-hidden />}
        />
        <StatCard
          label="Public website"
          value={
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-base font-medium break-all text-primary hover:underline"
            >
              {publicUrl.replace(/^https?:\/\//, '')}
              <ExternalLink className="size-4 shrink-0" aria-hidden />
            </a>
          }
          hint="Schedules, events, pujas and donations — live for devotees"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {QUICK_ACTIONS.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/40"
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

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">Your role</dt>
              <dd className="font-medium capitalize sm:mt-1">{membership.roleName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">Country</dt>
              <dd className="font-medium sm:mt-1">
                {membership.country === 'IN' ? 'India' : 'Bangladesh'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="font-medium sm:mt-1">{membership.currency}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">Online payments</dt>
              <dd className="font-medium sm:mt-1">
                {membership.currency === 'INR' ? 'Razorpay — active' : 'Coming soon'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
