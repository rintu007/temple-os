import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, cn } from '@templeos/ui';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';
import { formatEventWhen } from '@/lib/format-event';
import { eventService, resolveSite } from '@/lib/services';

const PAGE_SIZE = 12;

interface EventsPageProps {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ scope?: string; page?: string }>;
}

export async function generateMetadata({ params }: EventsPageProps): Promise<Metadata> {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) return { title: 'Site not found' };
  return { title: `Events · ${site.name}`, robots: { index: false } };
}

export default async function EventsPage({ params, searchParams }: EventsPageProps) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const locale = await getLocale();
  const t = getDict(locale);
  const sp = await searchParams;
  const scope = sp.scope === 'past' ? 'past' : 'upcoming';
  const page = Math.max(1, Number(sp.page) || 1);

  const result = await eventService().listPublic(site.organizationId, {
    scope,
    page,
    pageSize: PAGE_SIZE,
  });
  const data = result.ok ? result.value : { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="text-center">
        <div className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          {t.events.eyebrow}
        </div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          {t.events.title}
        </h1>
      </header>

      <div className="mt-8 flex justify-center gap-2">
        {(['upcoming', 'past'] as const).map((s) => (
          <Link
            key={s}
            href={`/events?scope=${s}`}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              scope === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            {s === 'upcoming' ? t.events.upcoming : t.events.past}
          </Link>
        ))}
      </div>

      {data.items.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">{t.events.none}</p>
      ) : (
        <ul className="mt-10 space-y-3">
          {data.items.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-xl border border-border bg-card px-5 py-4 shadow-card"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {e.title}
                  {e.kind === 'festival' ? <Badge variant="primary">{t.events.festival}</Badge> : null}
                </div>
                {e.description || e.location ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
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
      )}

      {totalPages > 1 ? (
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link
              href={`/events?scope=${scope}&page=${page - 1}`}
              className="font-medium text-primary hover:underline"
            >
              ← {t.events.prev}
            </Link>
          ) : (
            <span className="text-muted-foreground/50">← {t.events.prev}</span>
          )}
          <span className="text-muted-foreground">{t.events.pageOf(page, totalPages)}</span>
          {page < totalPages ? (
            <Link
              href={`/events?scope=${scope}&page=${page + 1}`}
              className="font-medium text-primary hover:underline"
            >
              {t.events.next} →
            </Link>
          ) : (
            <span className="text-muted-foreground/50">{t.events.next} →</span>
          )}
        </div>
      ) : null}
    </main>
  );
}
