import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { galleryService, resolveSite } from '@/lib/services';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';

interface GalleryPageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: GalleryPageProps): Promise<Metadata> {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) return { title: 'Site not found' };
  return {
    title: `Gallery · ${site.name}`,
    robots: { index: false },
  };
}

export default async function GalleryPage({ params }: GalleryPageProps) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const locale = await getLocale();
  const t = getDict(locale);
  const images = await galleryService().listPublicImages(site.organizationId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="text-center">
        <div className="text-sm font-medium uppercase tracking-widest text-primary">{t.gallery.eyebrow}</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{site.name}</h1>
      </header>

      {images.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">
          {t.gallery.comingSoon}{' '}
          <Link href="/" className="text-primary hover:underline">
            {t.gallery.seeSchedule}
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((img) => (
            <li key={img.id} className="overflow-hidden rounded-xl border border-border">
              {/* Plain <img>: Supabase-hosted originals, no next/image optimization needed */}
              <img
                src={img.url}
                alt={img.caption ?? `Photo from ${site.name}`}
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform hover:scale-105"
              />
              {img.caption ? (
                <p className="truncate p-2 text-xs text-muted-foreground">{img.caption}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
