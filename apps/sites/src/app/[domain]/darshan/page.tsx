import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookForm } from '@/features/darshan/components/book-form';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';
import { darshanService, resolveSite } from '@/lib/services';

interface DarshanPageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: DarshanPageProps): Promise<Metadata> {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) return { title: 'Site not found' };
  return { title: `Darshan · ${site.name}`, robots: { index: false } };
}

function formatDate(iso: string, locale: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default async function DarshanPage({ params }: DarshanPageProps) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const locale = await getLocale();
  const t = getDict(locale);
  const slots = await darshanService().listPublicSlots(site.organizationId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="text-center">
        <div className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          {t.darshan.eyebrow}
        </div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          {t.darshan.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.darshan.intro}</p>
      </header>

      {slots.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">{t.darshan.none}</p>
      ) : (
        <div className="mt-12 space-y-6">
          {slots.map((s) => (
            <section key={s.id} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">{s.name}</h2>
                <span
                  className={
                    s.remaining > 0
                      ? 'text-sm font-semibold text-primary'
                      : 'text-sm font-semibold text-muted-foreground'
                  }
                >
                  {s.remaining > 0 ? t.darshan.remaining(s.remaining) : t.darshan.full}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatDate(s.slotDate, locale)} · {s.startTime.slice(0, 5)}
                {s.endTime ? `–${s.endTime.slice(0, 5)}` : ''}
              </p>
              {s.remaining > 0 ? (
                <BookForm locale={locale} organizationId={site.organizationId} slotId={s.id} />
              ) : null}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
