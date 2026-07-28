'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { postService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function postInput(formData: FormData) {
  return {
    title: field(formData, 'title'),
    slug: field(formData, 'slug'),
    excerpt: field(formData, 'excerpt'),
    body: field(formData, 'body'),
    coverImageUrl: field(formData, 'coverImageUrl'),
    authorName: field(formData, 'authorName'),
  };
}

export async function createPostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await postService().createPost(ctx, postInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/website/blog');
  redirect(`/website/blog/${result.value.id}`);
}

export async function updatePostAction(
  postId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await postService().updatePost(ctx, postId, postInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/website/blog');
  revalidatePath(`/website/blog/${postId}`);
  return { message: 'Saved' };
}

export async function setPostStatusAction(
  postId: string,
  status: 'draft' | 'published',
): Promise<void> {
  const { ctx } = await requireTenantContext();
  await postService().setPostStatus(ctx, postId, status);
  revalidatePath('/website/blog');
  revalidatePath(`/website/blog/${postId}`);
}

export async function deletePostAction(postId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await postService().deletePost(ctx, postId);
  revalidatePath('/website/blog');
}
