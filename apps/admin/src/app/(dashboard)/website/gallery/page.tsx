import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Button } from '@templeos/ui';
import { deleteGalleryImageAction } from '@/features/website/gallery-actions';
import { UploadImageForm } from '@/features/website/components/upload-image-form';
import { requireTenantContext } from '@/lib/session';
import { galleryService } from '@/lib/services';

export const metadata: Metadata = { title: 'Gallery' };

export default async function GalleryAdminPage() {
  const { ctx } = await requireTenantContext();
  const configured = galleryService().isStorageConfigured();
  const images = await galleryService().listImages(ctx);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/website" className="text-sm text-muted-foreground hover:text-foreground">
          ← Website
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Gallery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Photos shown on your website&apos;s gallery page.
        </p>
      </div>

      {!configured ? (
        <Alert tone="info">
          Image uploads are not configured yet — add <code>SUPABASE_SERVICE_ROLE_KEY</code> to the
          environment to enable the gallery.
        </Alert>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-card p-6">
          <UploadImageForm />
        </div>
      )}

      {images.ok && images.value.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.value.map((img) => (
            <li key={img.id} className="group relative overflow-hidden rounded-xl border border-border">
              {/* Plain <img>: Supabase-hosted originals, no next/image optimization needed */}
              <img
                src={img.url}
                alt={img.caption ?? 'Gallery image'}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
              <div className="flex items-center justify-between gap-2 p-2">
                <span className="truncate text-xs text-muted-foreground">
                  {img.caption ?? 'No caption'}
                </span>
                <form action={deleteGalleryImageAction.bind(null, img.id)}>
                  <Button variant="ghost" size="sm" type="submit">
                    Remove
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : configured ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No photos yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload photos of your temple, festivals and events.
          </p>
        </div>
      ) : null}
    </div>
  );
}
