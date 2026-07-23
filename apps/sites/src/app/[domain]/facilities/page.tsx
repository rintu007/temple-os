import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatMoney } from '@templeos/ui';
import { RequestForm } from '@/features/facilities/components/request-form';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';
import { facilityService, resolveSite } from '@/lib/services';

interface FacilitiesPageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: FacilitiesPageProps): Promise<Metadata> {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) return { title: 'Site not found' };
  return { title: `Halls · ${site.name}`, robots: { index: false } };
}

export default async function FacilitiesPage({ params }: FacilitiesPageProps) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const locale = await getLocale();
  const t = getDict(locale);
  const facilities = await facilityService().listPublicFacilities(site.organizationId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="text-center">
        <div className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          {t.facilities.eyebrow}
        </div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          {t.facilities.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.facilities.intro}</p>
      </header>

      {facilities.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">{t.facilities.none}</p>
      ) : (
        <div className="mt-12 space-y-6">
          {facilities.map((f) => (
            <section key={f.id} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">{f.name}</h2>
                <span className="text-sm font-semibold">
                  {formatMoney(f.rentAmount, f.currency)}
                </span>
              </div>
              {f.capacity ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t.facilities.capacity(f.capacity)}
                </p>
              ) : null}
              {f.description ? (
                <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
                  {f.description}
                </p>
              ) : null}
              <RequestForm locale={locale} organizationId={site.organizationId} facilityId={f.id} />
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
