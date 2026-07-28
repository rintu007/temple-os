import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, Button } from '@templeos/ui';
import { deletePostAction, setPostStatusAction } from '@/features/blog/actions';
import { requireTenantContext } from '@/lib/session';
import { postService } from '@/lib/services';

export const metadata: Metadata = { title: 'Blog' };

export default async function BlogPage() {
  const { ctx } = await requireTenantContext();
  const result = await postService().listPosts(ctx);
  if (!result.ok) return <Alert tone="error">{result.error.message}</Alert>;
  const items = result.value;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/website" className="text-sm text-muted-foreground hover:text-foreground">
            ← Website
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Longer-form news and updates, each with its own permalinked page — published posts are
            indexable by search engines.
          </p>
        </div>
        <Link
          href="/website/blog/new"
          className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
        >
          New post
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No posts yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Festival recaps, project updates, appeals — write your first post.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <Link
                  href={`/website/blog/${p.id}`}
                  className="flex items-center gap-2 font-medium hover:underline"
                >
                  {p.title}
                  {p.status === 'published' ? (
                    <Badge variant="success">Published</Badge>
                  ) : (
                    <Badge variant="outline">Draft</Badge>
                  )}
                </Link>
                <p className="mt-1 truncate text-sm text-muted-foreground">/blog/{p.slug}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.status === 'published' && p.publishedAt
                    ? `Published ${p.publishedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : `Created ${p.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <form
                  action={setPostStatusAction.bind(
                    null,
                    p.id,
                    p.status === 'published' ? 'draft' : 'published',
                  )}
                >
                  <Button
                    variant={p.status === 'published' ? 'outline' : 'primary'}
                    size="sm"
                    type="submit"
                  >
                    {p.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                </form>
                <form action={deletePostAction.bind(null, p.id)}>
                  <Button variant="ghost" size="sm" type="submit">
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
