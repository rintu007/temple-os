import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button } from '@templeos/ui';
import { setPostStatusAction, updatePostAction } from '@/features/blog/actions';
import { PostForm } from '@/features/blog/components/post-form';
import { requireTenantContext } from '@/lib/session';
import { postService } from '@/lib/services';

interface PostDetailProps {
  params: Promise<{ postId: string }>;
}

export const metadata: Metadata = { title: 'Edit post' };

export default async function PostDetailPage({ params }: PostDetailProps) {
  const { postId } = await params;
  const { ctx } = await requireTenantContext();
  const result = await postService().getPost(ctx, postId);
  if (!result.ok) notFound();
  const post = result.value;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/website/blog" className="text-sm text-muted-foreground hover:text-foreground">
          ← Blog
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{post.title}</h1>
          {post.status === 'published' ? (
            <Badge variant="success">Published</Badge>
          ) : (
            <Badge variant="outline">Draft</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">/blog/{post.slug}</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Status</h2>
        <form
          action={setPostStatusAction.bind(
            null,
            postId,
            post.status === 'published' ? 'draft' : 'published',
          )}
        >
          <Button variant={post.status === 'published' ? 'outline' : 'primary'} size="sm" type="submit">
            {post.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Post details</h2>
        <PostForm action={updatePostAction.bind(null, postId)} post={post} submitLabel="Save changes" />
      </section>
    </div>
  );
}
