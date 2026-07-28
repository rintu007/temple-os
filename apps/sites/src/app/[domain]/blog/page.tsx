import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { resolveSite, postService } from '@/lib/services';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';

interface BlogPageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) return { title: 'Site not found' };
  return {
    title: `Blog · ${site.name}`,
    robots: { index: false },
  };
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const locale = await getLocale();
  const t = getDict(locale);
  const posts = await postService().listPublicPosts(site.organizationId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="text-center">
        <div className="text-sm font-medium uppercase tracking-widest text-primary">
          {t.blog.eyebrow}
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{t.blog.title}</h1>
      </header>

      {posts.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">{t.blog.comingSoon}</p>
      ) : (
        <ul className="mt-12 space-y-10">
          {posts.map((p) => (
            <li key={p.id} className="border-b border-border pb-10 last:border-0">
              {p.coverImageUrl ? (
                <Link href={`/blog/${p.slug}`}>
                  {/* Plain <img>: cover images may be hosted anywhere, not just Supabase */}
                  <img
                    src={p.coverImageUrl}
                    alt={p.title}
                    loading="lazy"
                    className="aspect-video w-full rounded-xl border border-border object-cover"
                  />
                </Link>
              ) : null}
              <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                <Link href={`/blog/${p.slug}`} className="hover:underline">
                  {p.title}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {p.publishedAt?.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                {p.authorName ? ` · ${t.blog.by(p.authorName)}` : ''}
              </p>
              {p.excerpt ? <p className="mt-3 leading-relaxed">{p.excerpt}</p> : null}
              <Link
                href={`/blog/${p.slug}`}
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                {t.blog.readMore}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
