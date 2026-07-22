'use server';

import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/form-state';
import { galleryService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export async function uploadGalleryImageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image to upload' };
  }
  const caption = formData.get('caption');

  const result = await galleryService().uploadImage(ctx, {
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type,
    caption: typeof caption === 'string' ? caption : null,
  });
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/website/gallery');
  return { message: 'Image uploaded — it is live on your gallery page.' };
}

export async function deleteGalleryImageAction(imageId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await galleryService().deleteImage(ctx, imageId);
  revalidatePath('/website/gallery');
}
