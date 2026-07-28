'use client';

import { useActionState } from 'react';
import type { PostDetail } from '@templeos/core';
import { Alert, Button, Input, Label, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface PostFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  post?: PostDetail;
  submitLabel: string;
}

export function PostForm({ action, post, submitLabel }: PostFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={post?.title}
          required
          minLength={3}
          placeholder="Diwali Celebrations 2026"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Permalink slug (optional)</Label>
        <Input
          id="slug"
          name="slug"
          defaultValue={post?.slug}
          placeholder="Leave blank to generate from the title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="excerpt">Excerpt (optional)</Label>
        <Textarea
          id="excerpt"
          name="excerpt"
          defaultValue={post?.excerpt ?? ''}
          rows={2}
          maxLength={300}
          placeholder="A short summary shown on the blog index and in search results"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">Body</Label>
        <Textarea
          id="body"
          name="body"
          defaultValue={post?.body ?? ''}
          rows={12}
          required
          minLength={10}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="coverImageUrl">Cover image URL (optional)</Label>
          <Input
            id="coverImageUrl"
            name="coverImageUrl"
            type="url"
            defaultValue={post?.coverImageUrl ?? ''}
            placeholder="https://…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="authorName">Author (optional)</Label>
          <Input id="authorName" name="authorName" defaultValue={post?.authorName ?? ''} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
