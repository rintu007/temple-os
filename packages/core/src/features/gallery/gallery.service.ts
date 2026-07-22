import { and, desc, eq } from 'drizzle-orm';
import { auditLogs, galleryImages, newId, withTenantContext, type Db } from '@templeos/db';
import {
  authorize,
  domainError,
  err,
  notFound,
  ok,
  type Result,
  type TenantContext,
} from '../../shared';
import {
  MAX_IMAGE_BYTES,
  extensionForContentType,
  storageFromEnv,
  type StorageClient,
} from './storage';
import type { GalleryImage } from './gallery.types';

const MAX_IMAGES_PER_ORG = 60;
const MAX_CAPTION = 200;

export interface UploadImageParams {
  bytes: Uint8Array;
  contentType: string;
  caption?: string | null;
}

export function createGalleryService({ db }: { db: Db }) {
  const guc = (ctx: TenantContext) => ({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  const toImage = (
    storage: StorageClient,
    row: { id: string; storagePath: string; caption: string | null; createdAt: Date },
  ): GalleryImage => ({
    id: row.id,
    url: storage.publicUrl(row.storagePath),
    caption: row.caption,
    createdAt: row.createdAt,
  });

  return {
    /** UI gate: uploads need the Supabase service role key configured. */
    isStorageConfigured(): boolean {
      return storageFromEnv() !== null;
    },

    async listImages(ctx: TenantContext): Promise<Result<GalleryImage[]>> {
      const auth = authorize(ctx, 'website:read');
      if (!auth.ok) return auth;
      const storage = storageFromEnv();
      if (!storage) return ok([]);

      const rows = await withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select()
          .from(galleryImages)
          .where(eq(galleryImages.organizationId, ctx.organizationId))
          .orderBy(desc(galleryImages.createdAt)),
      );
      return ok(rows.map((r) => toImage(storage, r)));
    },

    async uploadImage(ctx: TenantContext, params: UploadImageParams): Promise<Result<GalleryImage>> {
      const auth = authorize(ctx, 'website:write');
      if (!auth.ok) return auth;
      const storage = storageFromEnv();
      if (!storage) {
        return err(
          domainError('VALIDATION', 'Image uploads are not configured (missing storage key)'),
        );
      }

      const ext = extensionForContentType(params.contentType);
      if (!ext) {
        return err(domainError('VALIDATION', 'Only JPEG, PNG, WebP or GIF images are supported'));
      }
      if (params.bytes.byteLength === 0) {
        return err(domainError('VALIDATION', 'The uploaded file is empty'));
      }
      if (params.bytes.byteLength > MAX_IMAGE_BYTES) {
        return err(domainError('VALIDATION', 'Images must be 5 MB or smaller'));
      }
      const caption = (params.caption ?? '').trim().slice(0, MAX_CAPTION) || null;

      const existing = await withTenantContext(db, guc(ctx), (tx) =>
        tx
          .select({ id: galleryImages.id })
          .from(galleryImages)
          .where(eq(galleryImages.organizationId, ctx.organizationId)),
      );
      if (existing.length >= MAX_IMAGES_PER_ORG) {
        return err(
          domainError('VALIDATION', `Gallery is full (max ${MAX_IMAGES_PER_ORG} images) — remove some first`),
        );
      }

      await storage.ensureGalleryBucket();
      const storagePath = `${ctx.organizationId}/${newId()}.${ext}`;
      await storage.uploadObject(storagePath, params.bytes, params.contentType);

      try {
        const row = await withTenantContext(db, guc(ctx), async (tx) => {
          const [image] = await tx
            .insert(galleryImages)
            .values({ id: newId(), organizationId: ctx.organizationId, storagePath, caption })
            .returning();
          if (!image) throw new Error('gallery insert returned no row');

          await tx.insert(auditLogs).values({
            organizationId: ctx.organizationId,
            actorUserId: ctx.userId,
            action: 'gallery.image_added',
            entityType: 'gallery_image',
            entityId: image.id,
            after: { storagePath, caption },
          });
          return image;
        });
        return ok(toImage(storage, row));
      } catch (e) {
        await storage.deleteObject(storagePath); // don't strand the object
        throw e;
      }
    },

    async deleteImage(ctx: TenantContext, imageId: string): Promise<Result<null>> {
      const auth = authorize(ctx, 'website:write');
      if (!auth.ok) return auth;
      const storage = storageFromEnv();
      if (!storage) {
        return err(domainError('VALIDATION', 'Image storage is not configured'));
      }

      const removed = await withTenantContext(db, guc(ctx), async (tx) => {
        const [row] = await tx
          .delete(galleryImages)
          .where(
            and(
              eq(galleryImages.id, imageId),
              eq(galleryImages.organizationId, ctx.organizationId),
            ),
          )
          .returning();
        if (!row) return null;

        await tx.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: 'gallery.image_removed',
          entityType: 'gallery_image',
          entityId: imageId,
          before: { storagePath: row.storagePath },
        });
        return row;
      });
      if (!removed) return err(notFound('Image'));

      await storage.deleteObject(removed.storagePath);
      return ok(null);
    },

    /** Public gallery page — no auth. */
    async listPublicImages(organizationId: string): Promise<GalleryImage[]> {
      const storage = storageFromEnv();
      if (!storage) return [];
      const rows = await withTenantContext(db, { organizationId }, (tx) =>
        tx
          .select()
          .from(galleryImages)
          .where(eq(galleryImages.organizationId, organizationId))
          .orderBy(desc(galleryImages.createdAt)),
      );
      return rows.map((r) => toImage(storage, r));
    },
  };
}

export type GalleryService = ReturnType<typeof createGalleryService>;
