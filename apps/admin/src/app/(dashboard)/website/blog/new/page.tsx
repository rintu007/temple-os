import type { Metadata } from 'next';
import Link from 'next/link';
import { createPostAction } from '@/features/blog/actions';
import { PostForm } from '@/features/blog/components/post-form';

export const metadata: Metadata = { title: 'New post' };

export default function NewPostPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/website/blog" className="text-sm text-muted-foreground hover:text-foreground">
          ← Blog
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved as a draft — publish it from the blog list once it&apos;s ready.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <PostForm action={createPostAction} submitLabel="Create draft" />
      </section>
    </div>
  );
}
