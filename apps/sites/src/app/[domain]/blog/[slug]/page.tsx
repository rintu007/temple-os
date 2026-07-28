import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/json-ld';
import { hostnameFromDomainParam, resolveSite, postService } from '@/lib/services';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';

interface PostPageProps {
  params: Promise<{ domain: string; slug: string }>;
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { domain, slug } = await params;
  const site = await resolveSite(domain);
  if (!site) return { title: 'Site not found' };
  const post = await postService().getPublicPost(site.organizationId, slug);
  if (!post) return { title: `Blog · ${site.name}` };

  const description = post.excerpt ?? post.body.slice(0, 160);
  return {
    title: `${post.title} · ${site.name}`,
    description,
    robots: { index: false },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { domain, slug } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const locale = await getLocale();
  const t = getDict(locale);
  const post = await postService().getPublicPost(site.organizationId, slug);
  if (!post) notFound();

  const postUrl = `https://${hostnameFromDomainParam(domain)}/blog/${post.slug}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          ...(post.excerpt ? { description: post.excerpt } : {}),
          datePublished: post.publishedAt?.toISOString(),
          dateModified: post.publishedAt?.toISOString(),
          ...(post.coverImageUrl ? { image: [post.coverImageUrl] } : {}),
          ...(post.authorName ? { author: { '@type': 'Person', name: post.authorName } } : {}),
          publisher: { '@type': 'Organization', name: site.name },
          mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
        }}
      />
      <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground">
        {t.blog.back}
      </Link>

      <article className="mt-6">
        <h1 className="text-4xl font-semibold tracking-tight">{post.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {post.publishedAt?.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
          {post.authorName ? ` · ${t.blog.by(post.authorName)}` : ''}
        </p>

        {post.coverImageUrl ? (
          // Plain <img>: cover images may be hosted anywhere, not just Supabase
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="mt-6 aspect-video w-full rounded-xl border border-border object-cover"
          />
        ) : null}

        <div className="mt-8 space-y-4 leading-relaxed whitespace-pre-line">{post.body}</div>
      </article>
    </main>
  );
}
