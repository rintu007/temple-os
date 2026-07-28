import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, formatMoney, formatTime } from '@templeos/ui';
import { JsonLd } from '@/components/json-ld';
import { Section } from '@/components/section';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';
import { DonateForm } from '@/features/donations/components/donate-form';
import { JoinMembership } from '@/features/membership/components/join-membership';
import { BookPuja } from '@/features/pujas/components/book-puja';
import {
  campaignService,
  eventService,
  hostnameFromDomainParam,
  membershipService,
  organizationService,
  paymentService,
  pujaService,
  templeService,
  websiteService,
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

  const [temples, upcomingEvents, pujaTypes, membershipPlans, notices, campaigns, content] =
    await Promise.all([
      templeService().listPublicTemples(site.organizationId),
      eventService().listPublicUpcoming(site.organizationId, 8),
      pujaService().listPublicPujaTypes(site.organizationId),
      membershipService().listPublicPlans(site.organizationId),
      websiteService().listPublicAnnouncements(site.organizationId, 3),
      campaignService().listPublicCampaigns(site.organizationId),
      websiteService().getPublicContent(site.organizationId),
    ]);
  const locale = await getLocale();
  const t = getDict(locale);
  const checkoutAvailable = paymentService().isOnlineCheckoutAvailable(site.currency);
  // Puja booking + membership checkout are Razorpay-modal flows — INR only for now.
  const inrCheckoutAvailable = site.currency === 'INR' && checkoutAvailable;

  const siteUrl = `https://${hostnameFromDomainParam(domain)}`;
  const sameAs = [content.facebookUrl, content.instagramUrl, content.youtubeUrl].filter(
    (v): v is string => Boolean(v),
  );

  return (
    <main>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'HinduTemple',
          name: site.name,
          url: siteUrl,
          ...(content.tagline ? { description: content.tagline } : {}),
          ...(content.addressText ? { address: content.addressText } : {}),
          ...(content.contactPhone ? { telephone: content.contactPhone } : {}),
          ...(content.contactEmail ? { email: content.contactEmail } : {}),
          ...(sameAs.length > 0 ? { sameAs } : {}),
        }}
      />
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
            {t.hero.welcomeTo}
          </div>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            {site.name}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            {t.hero.tagline}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/#donate"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-raised transition-colors hover:bg-primary/90"
            >
              {t.hero.makeDonation}
            </Link>
            {inrCheckoutAvailable && pujaTypes.length > 0 ? (
              <Link
                href="/#book-puja"
                className="rounded-full border border-input bg-card px-6 py-2.5 text-sm font-semibold shadow-card transition-colors hover:bg-muted/60"
              >
                {t.hero.bookPuja}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {notices.length > 0 ? (
        <Section className="!py-10" align="left">
          <div className="space-y-3">
            {notices.map((n) => (
              <div key={n.id} className="rounded-xl border border-primary/25 bg-accent/60 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold tracking-widest text-primary uppercase">
                    {t.home.noticesEyebrow}
                  </span>
                  {n.publishedAt ? (
                    <span className="text-xs text-muted-foreground">
                      {n.publishedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 font-medium">{n.title}</div>
                {n.body ? (
                  <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{n.body}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {campaigns.length > 0 ? (
        <Section eyebrow={t.home.campaignsEyebrow} title={t.home.campaignsTitle} tone="muted">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-raised"
              >
                <h3 className="font-medium">{c.title}</h3>
                {c.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                ) : null}
                <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${c.percent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{formatMoney(c.raisedAmount, c.currency)}</span>
                  <span className="text-muted-foreground">{c.percent}%</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.home.raisedOf(formatMoney(c.raisedAmount, c.currency), formatMoney(c.goalAmount, c.currency))}
                </p>
                <a
                  href="/#donate"
                  className="mt-4 inline-flex w-fit rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
                >
                  {t.hero.makeDonation}
                </a>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {temples.length === 0 ? (
        <Section>
          <p className="text-center text-muted-foreground">{t.home.sitePreparing}</p>
        </Section>
      ) : (
        <Section>
          <div className="space-y-6">
            {temples.map((temple) => (
              <div key={temple.id} className="rounded-2xl border border-border bg-card p-8 shadow-card">
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
                  {temple.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[temple.deity, temple.city].filter(Boolean).join(' · ')}
                </p>

                {temple.schedule.length > 0 ? (
                  <div className="mt-6">
                    <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t.home.dailySchedule}
                    </h3>
                    <ul className="mt-3 grid gap-x-8 gap-y-2.5 divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
                      {temple.schedule.map((item) => (
                        <li key={item.id} className="flex items-baseline justify-between gap-6 py-2.5 sm:py-0">
                          <div className="min-w-0">
                            <span className="font-medium">{item.title}</span>
                            {item.description ? (
                              <span className="ml-2 text-sm text-muted-foreground">{item.description}</span>
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
              </div>
            ))}
          </div>
        </Section>
      )}

      {upcomingEvents.length > 0 ? (
        <Section eyebrow={t.home.calendarEyebrow} title={t.home.upcomingEvents} tone="muted">
          <ul className="space-y-3">
            {upcomingEvents.map((e) => (
              <li
                key={e.id}
                className="flex items-baseline justify-between gap-6 rounded-xl border border-border bg-card px-5 py-4 shadow-card transition-shadow hover:shadow-raised"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {e.title}
                    {e.kind === 'festival' ? <Badge variant="primary">{t.home.festival}</Badge> : null}
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
        </Section>
      ) : null}

      {inrCheckoutAvailable && pujaTypes.length > 0 ? (
        <Section id="book-puja" eyebrow={t.home.servicesEyebrow} title={t.home.bookPuja}>
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
            <BookPuja
              locale={locale}
              organizationId={site.organizationId}
              organizationName={site.name}
              currency={site.currency}
              pujaTypes={pujaTypes}
            />
          </div>
        </Section>
      ) : null}

      {inrCheckoutAvailable && membershipPlans.length > 0 ? (
        <Section id="membership" eyebrow={t.home.communityEyebrow} title={t.home.becomeMember} tone="muted">
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
            <JoinMembership
              locale={locale}
              organizationId={site.organizationId}
              organizationName={site.name}
              currency={site.currency}
              plans={membershipPlans}
            />
          </div>
        </Section>
      ) : null}

      <Section id="donate" eyebrow={t.home.supportEyebrow} title={t.home.makeDonation} className="!pb-20">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
          {checkoutAvailable ? (
            <DonateForm
              locale={locale}
              organizationId={site.organizationId}
              organizationName={site.name}
              currency={site.currency}
            />
          ) : (
            <p className="text-center text-sm text-muted-foreground">{t.home.donationsComingSoon(site.name)}</p>
          )}
        </div>
      </Section>
    </main>
  );
}
