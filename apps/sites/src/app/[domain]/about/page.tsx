import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { resolveSite, websiteService } from '@/lib/services';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';

interface AboutPageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) return { title: 'Site not found' };
  return {
    title: `About · ${site.name}`,
    robots: { index: false },
  };
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const locale = await getLocale();
  const t = getDict(locale);
  const content = await websiteService().getPublicContent(site.organizationId);
  const hasContent = Boolean(content.aboutText || content.historyText);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="text-center">
        <div className="text-sm font-medium uppercase tracking-widest text-primary">{t.about.eyebrow}</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{site.name}</h1>
        {content.tagline ? (
          <p className="mt-3 text-lg text-muted-foreground">{content.tagline}</p>
        ) : null}
      </header>

      {!hasContent ? (
        <p className="mt-12 text-center text-muted-foreground">
          {t.about.comingSoon}{' '}
          <Link href="/contact" className="text-primary hover:underline">
            {t.about.getInTouch}
          </Link>
        </p>
      ) : (
        <div className="mt-12 space-y-10">
          {content.aboutText ? (
            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                {t.about.ourTemple}
              </h2>
              <p className="mt-4 whitespace-pre-line leading-relaxed">{content.aboutText}</p>
            </section>
          ) : null}
          {content.historyText ? (
            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                {t.about.ourHistory}
              </h2>
              <p className="mt-4 whitespace-pre-line leading-relaxed">{content.historyText}</p>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
