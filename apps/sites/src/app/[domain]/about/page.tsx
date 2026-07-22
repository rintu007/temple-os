import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { resolveSite, websiteService } from '@/lib/services';

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

  const content = await websiteService().getPublicContent(site.organizationId);
  const hasContent = Boolean(content.aboutText || content.historyText);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="text-center">
        <div className="text-sm font-medium uppercase tracking-widest text-primary">About</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{site.name}</h1>
        {content.tagline ? (
          <p className="mt-3 text-lg text-muted-foreground">{content.tagline}</p>
        ) : null}
      </header>

      {!hasContent ? (
        <p className="mt-12 text-center text-muted-foreground">
          More about our temple is coming soon.{' '}
          <Link href="/contact" className="text-primary hover:underline">
            Get in touch
          </Link>{' '}
          if you have any questions.
        </p>
      ) : (
        <div className="mt-12 space-y-10">
          {content.aboutText ? (
            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                Our temple
              </h2>
              <p className="mt-4 whitespace-pre-line leading-relaxed">{content.aboutText}</p>
            </section>
          ) : null}
          {content.historyText ? (
            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                Our history
              </h2>
              <p className="mt-4 whitespace-pre-line leading-relaxed">{content.historyText}</p>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
