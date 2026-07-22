import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatTime } from '@templeos/ui';
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="text-center">
        <div className="text-sm font-medium uppercase tracking-widest text-primary">
          Welcome to
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{site.name}</h1>
      </header>

      {temples.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">
          Our website is being prepared. Soon you&apos;ll find our daily schedule, events,
          festivals and online donations here.
        </p>
      ) : (
        <div className="mt-14 space-y-10">
          {temples.map((temple) => (
            <section key={temple.id} className="rounded-xl border border-border p-8">
              <h2 className="text-2xl font-semibold tracking-tight">{temple.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {[temple.deity, temple.city].filter(Boolean).join(' · ')}
              </p>

              {temple.schedule.length > 0 ? (
                <div className="mt-6">
                  <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Daily schedule
                  </h3>
                  <ul className="mt-3 divide-y divide-border">
                    {temple.schedule.map((item) => (
                      <li key={item.id} className="flex items-baseline justify-between gap-6 py-2.5">
                        <div>
                          <span className="font-medium">{item.title}</span>
                          {item.description ? (
                            <span className="ml-2 text-sm text-muted-foreground">
                              {item.description}
                            </span>
                          ) : null}
                        </div>
                        <span className="whitespace-nowrap text-sm text-muted-foreground">
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
        <section className="mt-14">
          <h2 className="text-center text-sm font-medium uppercase tracking-widest text-primary">
            Upcoming events &amp; festivals
          </h2>
          <ul className="mt-6 space-y-3">
            {upcomingEvents.map((e) => (
              <li
                key={e.id}
                className="flex items-baseline justify-between gap-6 rounded-lg border border-border px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {e.title}
                    {e.kind === 'festival' ? (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        Festival
                      </span>
                    ) : null}
                  </div>
                  {e.description || e.location ? (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {[e.description, e.location].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                </div>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatEventWhen(e.startsAt, e.endsAt, e.allDay)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {checkoutAvailable && pujaTypes.length > 0 ? (
        <section id="book-puja" className="mt-14">
          <h2 className="text-center text-sm font-medium uppercase tracking-widest text-primary">
            Book a Puja
          </h2>
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-border p-8">
            <BookPuja
              organizationId={site.organizationId}
              organizationName={site.name}
              currency={site.currency}
              pujaTypes={pujaTypes}
            />
          </div>
        </section>
      ) : null}

      {checkoutAvailable && membershipPlans.length > 0 ? (
        <section id="membership" className="mt-14">
          <h2 className="text-center text-sm font-medium uppercase tracking-widest text-primary">
            Become a Member
          </h2>
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-border p-8">
            <JoinMembership
              organizationId={site.organizationId}
              organizationName={site.name}
              currency={site.currency}
              plans={membershipPlans}
            />
          </div>
        </section>
      ) : null}

      <section id="donate" className="mt-14">
        <h2 className="text-center text-sm font-medium uppercase tracking-widest text-primary">
          Donate
        </h2>
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-border p-8">
          {checkoutAvailable ? (
            <DonateForm
              organizationId={site.organizationId}
              organizationName={site.name}
              currency={site.currency}
            />
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Online donations are coming soon for {site.name}. Please contact the temple office
              to donate in the meantime.
            </p>
          )}
        </div>
      </section>

    </main>
  );
}
