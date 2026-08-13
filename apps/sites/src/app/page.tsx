import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/section';
import { PricingGrid } from '@/components/pricing-grid';
import { planService } from '@/lib/services';

export const metadata: Metadata = {
  title: 'TempleOS — Websites & management software for temples',
  description:
    'A public website, donation collection, puja booking, membership, and fund accounting — all in one platform built for Hindu temples.',
};

const signupUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/signup`;

/** Revalidate periodically so plan/price edits made in /platform/plans show up without a redeploy. */
export const revalidate = 300;

/**
 * Grouped exactly along the real module tiers (see plan_catalog: Starter/no
 * modules, then worship/community/finance-basic/accounting) so this section
 * flows directly into the pricing grid below it — "here's everything, here's
 * which plan includes which part" — rather than an arbitrary marketing split.
 */
const featureGroups = [
  {
    eyebrow: 'Free forever',
    title: 'Core operations, on every plan',
    body: 'The basics every temple needs — never gated behind a paid plan, even after a trial ends.',
    items: [
      'A public website on your own subdomain (or a custom domain later) — schedule, events, gallery, blog',
      'Online donations via Razorpay, SSLCommerz, or Stripe, matched automatically to your country and currency',
      'A self-service donor portal — devotees sign in with a magic link to see their history and download receipts',
      'A devotee directory, with bulk import for an existing list',
    ],
  },
  {
    eyebrow: 'Worship',
    title: 'Bookings, without the phone calls',
    body: 'Let devotees book directly, and give your priests a schedule they can actually see.',
    items: [
      'Puja and seva booking, with priest duty scheduling so nothing gets double-booked',
      'Darshan slot booking and a token queue for busy festival days',
      'Prasadam and annadanam session scheduling',
      'Facility bookings — halls, guest rooms, and more',
    ],
  },
  {
    eyebrow: 'Community & fundraising',
    title: 'Everyone who helps run the temple, in one place',
    body: 'Members, volunteers, office bearers, and the campaigns that fund it all.',
    items: [
      'Membership plans, renewals, and a member directory',
      'Volunteer signups and office-bearer records',
      'Email and WhatsApp broadcasts for festival notices and appeals',
      'Meetings, governance records, and a full staff activity log',
      'Campaigns, pledges, hundi collection counts, in-kind gifts, and recurring donations',
    ],
  },
  {
    eyebrow: 'Full fund accounting',
    title: 'For temples that need real books, not a spreadsheet',
    body: 'Everything above, plus the back office a larger trust actually runs on.',
    items: [
      'Multi-account bookkeeping, transfers, and bank reconciliation',
      'Payroll, budgets, and financial statements',
      'Loans, investments, grants, and vendor bills',
      'Asset and inventory tracking',
      '80G/tax receipts and an auto-generated annual report',
    ],
  },
];

const howItWorks = [
  {
    step: '1',
    title: 'Create your account',
    body: 'Sign up in under a minute — no card required. Your temple gets a free public website immediately.',
  },
  {
    step: '2',
    title: 'Add your temple',
    body: 'Bring in your devotee list, set your daily schedule, and customize your site with your own story and photos.',
  },
  {
    step: '3',
    title: 'Turn on what you need',
    body: 'Start free with the core. Add worship bookings, community tools, or full accounting as your temple grows.',
  },
  {
    step: '4',
    title: 'Let devotees help themselves',
    body: 'Donations, puja bookings, and receipts all happen without a staff member picking up the phone.',
  },
];

const faqs = [
  {
    q: 'Is my devotee data secure?',
    a: "Every temple's data is isolated at the database level, not just in the application — one temple can never see another's records, even through a bug. Data is encrypted in transit, and access is limited to what's needed to run the service.",
  },
  {
    q: 'Which countries do you support?',
    a: 'Built first for India and Bangladesh, with local payment gateways (Razorpay, SSLCommerz) and 80G tax receipts for India. Donations from other countries are accepted via Stripe in USD, GBP, CAD, or AUD.',
  },
  {
    q: 'Do I need any technical skill to run this?',
    a: "No. If you can use email, you can run your temple's website and donations. No code, no separate hosting, no developer required.",
  },
  {
    q: 'What happens to my public site if I stop paying?',
    a: "Nothing — your public website and your devotees' ability to donate online never stop working, regardless of your subscription status. A lapsed plan only affects staff-side tools like worship bookings or accounting.",
  },
];

export default async function MarketingHomePage() {
  const plans = await planService().listPlans();

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_130%_at_50%_-20%,hsl(var(--primary)/0.16),transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary/70 to-transparent"
        />
        <div className="relative mx-auto max-w-5xl px-6 py-20 text-center sm:py-28">
          <div className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
            Built for Hindu temples
          </div>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Every temple deserves a beautiful home on the web
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            A public website, online donations, puja bookings, membership, and fund accounting —
            one platform, live in minutes, free to start.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={signupUrl}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-raised transition-colors hover:bg-primary/90"
            >
              Start free trial
            </a>
            <Link
              href="/pricing"
              className="rounded-full border border-input bg-card px-6 py-2.5 text-sm font-semibold shadow-card transition-colors hover:bg-muted/60"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            14-day trial, no card required · free Starter plan forever
          </p>
        </div>
      </section>

      <Section eyebrow="Everything in one place" title="Run the whole temple, not just the website">
        <div className="space-y-10">
          {featureGroups.map((group, i) => (
            <div
              key={group.title}
              className={
                i > 0 ? 'border-t border-border/60 pt-10' : undefined
              }
            >
              <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div>
                  <div className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                    {group.eyebrow}
                  </div>
                  <h3 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
                    {group.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{group.body}</p>
                </div>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="rounded-xl border border-border bg-card p-4 text-sm shadow-card"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="How it works" title="From signup to your first donation, same day" tone="muted">
        <div className="grid gap-6 sm:grid-cols-4">
          {howItWorks.map((s) => (
            <div key={s.step}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {s.step}
              </div>
              <h3 className="mt-3 font-medium">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Simple pricing"
        title="Start free. Upgrade when you need more."
      >
        <PricingGrid plans={plans} signupUrl={signupUrl} compact />
        <div className="mt-8 text-center">
          <Link href="/pricing" className="text-sm font-medium text-primary hover:underline">
            Compare all plans in detail →
          </Link>
        </div>
      </Section>

      <Section eyebrow="Questions" title="Good to know" tone="muted">
        <dl className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section className="!pb-24">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-10 text-center shadow-card">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
            Ready to bring your temple online?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Create your temple&apos;s account in under a minute — no card required for the trial.
          </p>
          <a
            href={signupUrl}
            className="mt-6 inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-raised transition-colors hover:bg-primary/90"
          >
            Start free trial
          </a>
        </div>
      </Section>
    </main>
  );
}
