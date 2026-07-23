import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SignupForm } from '@/features/volunteers/components/signup-form';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';
import { resolveSite, volunteerService } from '@/lib/services';

interface VolunteerPageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: VolunteerPageProps): Promise<Metadata> {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) return { title: 'Site not found' };
  return { title: `Volunteer · ${site.name}`, robots: { index: false } };
}

export default async function VolunteerPage({ params }: VolunteerPageProps) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const locale = await getLocale();
  const t = getDict(locale);
  const opportunities = await volunteerService().listOpenOpportunities(site.organizationId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="text-center">
        <div className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          {t.volunteer.eyebrow}
        </div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          {t.volunteer.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.volunteer.intro}</p>
      </header>

      {opportunities.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">{t.volunteer.none}</p>
      ) : (
        <div className="mt-12 space-y-6">
          {opportunities.map((o) => (
            <section
              key={o.id}
              className="rounded-2xl border border-border bg-card p-6 shadow-card"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">{o.title}</h2>
                {o.servingOn ? (
                  <span className="text-sm text-muted-foreground">
                    {new Date(`${o.servingOn}T12:00:00`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                ) : null}
              </div>
              {o.description ? (
                <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                  {o.description}
                </p>
              ) : null}
              {o.slotsNeeded > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {o.signupCount} / {o.slotsNeeded}
                </p>
              ) : null}

              {o.full ? (
                <p className="mt-4 rounded-lg bg-muted/60 px-4 py-3 text-sm font-medium text-muted-foreground">
                  {t.volunteer.slotsFull}
                </p>
              ) : (
                <SignupForm locale={locale} organizationId={site.organizationId} opportunityId={o.id} />
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
