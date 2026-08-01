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

const featureHighlights = [
  {
    title: 'A public website for your temple',
    body: 'Daily schedule, events, gallery, and online donations — live on your own subdomain the moment you sign up, free forever.',
  },
  {
    title: 'Puja & seva bookings',
    body: 'Devotees book pujas, sevas, and darshan slots online; priests see the day’s schedule without a phone call.',
  },
  {
    title: 'Membership & volunteers',
    body: 'Track members, renewals, volunteer signups, office bearers, and send announcements — without a spreadsheet.',
  },
  {
    title: 'Campaigns & fundraising',
    body: 'Run fundraising campaigns, collect pledges, log hundi counts and in-kind offerings, all reconciled automatically.',
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
        <div className="grid gap-5 sm:grid-cols-2">
          {featureHighlights.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-raised"
            >
              <h3 className="font-medium">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Simple pricing"
        title="Start free. Upgrade when you need more."
        tone="muted"
      >
        <PricingGrid plans={plans} signupUrl={signupUrl} compact />
        <div className="mt-8 text-center">
          <Link href="/pricing" className="text-sm font-medium text-primary hover:underline">
            Compare all plans in detail →
          </Link>
        </div>
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
