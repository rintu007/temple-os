import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, formatTime } from '@templeos/ui';
import { DonateForm } from '@/features/donations/components/donate-form';
import { JoinMembership } from '@/features/membership/components/join-membership';
import { BookPuja } from '@/features/pujas/components/book-puja';
import {
  eventService,
  hostnameFromDomainParam,
  membershipService,
  organizationService,
  paymentService,
  pujaService,
  templeService,
} from '@/lib/services';

function formatEventWhen(startsAt: Date, endsAt: Date | null, allDay: boolean): string {
  const dateOpts = { day: 'numeric', month: 'short', year: 'numeric' } as const;
  const start = startsAt.toLocaleDateString('en-IN', dateOpts);
  if (endsAt && endsAt.toDateString() !== startsAt.toDateString()) {
    return `${start} – ${endsAt.toLocaleDateString('en-IN', dateOpts)}`;
  }
  if (allDay) return start;
  const time = startsAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${start} · ${time}`;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="text-center">
      <div className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{eyebrow}</div>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
        {title}
      </h2>
    </header>
  );
}

interface TenantPageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { domain } = await params;
  const site = await organizationService().resolveSiteByHostname(hostnameFromDomainParam(domain));
  if (!site) return { title: 'Site not found' };
  return {
    title: site.name,
    description: `${site.name} — daily schedule, events, donations and more.`,
    // Tenant sites stay out of search indexes until publishing lands (Phase 1)
    robots: { index: false },
  };
}

/**
 * Tenant homepage, resolved live from the database. The theme-driven CMS
 * renderer with ISR replaces this in Phase 1.
 */
export default async function TenantHomePage({ params }: TenantPageProps) {
  const { domain } = await params;
  const site = await organizationService().resolveSiteByHostname(hostnameFromDomainParam(domain));
  if (!site) notFound();

  const [temples, upcomingEvents, pujaTypes, membershipPlans] = await Promise.all([
    templeService().listPublicTemples(site.organizationId),
    eventService().listPublicUpcoming(site.organizationId, 8),
    pujaService().listPublicPujaTypes(site.organizationId),
    membershipService().listPublicPlans(site.organizationId),
  ]);
  const checkoutAvailable = paymentService().isOnlineCheckoutAvailable(site.currency);
  // Puja booking + membership checkout are Razorpay-modal flows — INR only for now.
  const inrCheckoutAvailable = site.currency === 'INR' && checkoutAvailable;

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_50%_-20%,hsl(var(--primary)/0.14),transparent)]"
        />
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center sm:py-28">
          <div className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
            Welcome to
          </div>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            {site.name}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Daily worship, festivals and community — join us in person or support the temple
            online.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/#donate"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-raised transition-colors hover:bg-primary/90"
            >
              Make a donation
            </Link>
            {inrCheckoutAvailable && pujaTypes.length > 0 ? (
              <Link
                href="/#book-puja"
                className="rounded-full border border-input bg-card px-6 py-2.5 text-sm font-semibold shadow-card transition-colors hover:bg-muted/60"
              >
                Book a puja
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 pb-20">
        {temples.length === 0 ? (
          <p className="mt-16 text-center text-muted-foreground">
            Our website is being prepared. Soon you&apos;ll find our daily schedule, events,
            festivals and online donations here.
          </p>
        ) : (
          <div className="mt-16 space-y-10">
            {temples.map((temple) => (
              <section
                key={temple.id}
                className="rounded-2xl border border-border bg-card p-8 shadow-card"
              >
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
                  {temple.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[temple.deity, temple.city].filter(Boolean).join(' · ')}
                </p>

                {temple.schedule.length > 0 ? (
                  <div className="mt-6">
                    <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Daily schedule
                    </h3>
                    <ul className="mt-3 divide-y divide-border">
                      {temple.schedule.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-baseline justify-between gap-6 py-2.5"
                        >
                          <div>
                            <span className="font-medium">{item.title}</span>
                            {item.description ? (
                              <span className="ml-2 text-sm text-muted-foreground">
                                {item.description}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
                            {formatTime(item.startTime)}
                            {item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        )}

        {upcomingEvents.length > 0 ? (
          <section className="mt-20">
            <SectionHeading eyebrow="Calendar" title="Upcoming Events & Festivals" />
            <ul className="mt-8 space-y-3">
              {upcomingEvents.map((e) => (
                <li
                  key={e.id}
                  className="flex items-baseline justify-between gap-6 rounded-xl border border-border bg-card px-5 py-4 shadow-card"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      {e.title}
                      {e.kind === 'festival' ? <Badge variant="primary">Festival</Badge> : null}
                    </div>
                    {e.description || e.location ? (
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {[e.description, e.location].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-sm whitespace-nowrap text-muted-foreground">
                    {formatEventWhen(e.startsAt, e.endsAt, e.allDay)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {inrCheckoutAvailable && pujaTypes.length > 0 ? (
          <section id="book-puja" className="mt-20 scroll-mt-24">
            <SectionHeading eyebrow="Services" title="Book a Puja" />
            <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
              <BookPuja
                organizationId={site.organizationId}
                organizationName={site.name}
                currency={site.currency}
                pujaTypes={pujaTypes}
              />
            </div>
          </section>
        ) : null}

        {inrCheckoutAvailable && membershipPlans.length > 0 ? (
          <section id="membership" className="mt-20 scroll-mt-24">
            <SectionHeading eyebrow="Community" title="Become a Member" />
            <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
              <JoinMembership
                organizationId={site.organizationId}
                organizationName={site.name}
                currency={site.currency}
                plans={membershipPlans}
              />
            </div>
          </section>
        ) : null}

        <section id="donate" className="mt-20 scroll-mt-24">
          <SectionHeading eyebrow="Support us" title="Make a Donation" />
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
            {checkoutAvailable ? (
              <DonateForm
                organizationId={site.organizationId}
                organizationName={site.name}
                currency={site.currency}
              />
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Online donations are coming soon for {site.name}. Please contact the temple
                office to donate in the meantime.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
