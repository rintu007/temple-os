/**
 * Minimal Supabase Storage REST client — no SDK dependency. Uses the service
 * role key server-side only; public read goes through the public object URL.
 */

export interface StorageConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

export const GALLERY_BUCKET = 'gallery';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function extensionForContentType(contentType: string): string | null {
  return EXTENSIONS[contentType.toLowerCase()] ?? null;
}

export function createStorageClient({ supabaseUrl, serviceRoleKey }: StorageConfig) {
  const base = supabaseUrl.replace(/\/$/, '');
  const authHeaders = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  };

  let bucketEnsured = false;

  return {
    /** Idempotent public-bucket creation; cached per process. */
    async ensureGalleryBucket(): Promise<void> {
      if (bucketEnsured) return;
      const res = await fetch(`${base}/storage/v1/bucket`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: GALLERY_BUCKET,
          name: GALLERY_BUCKET,
          public: true,
          file_size_limit: MAX_IMAGE_BYTES,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        const message = body?.message ?? '';
        // 400/409 "already exists" is success for our purposes
        if (!/exist/i.test(message)) {
          throw new Error(`Could not create storage bucket: ${message || res.status}`);
        }
      }
      bucketEnsured = true;
    },

    async uploadObject(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
      // Plain ArrayBuffer body: satisfies both DOM-lib and Node fetch typings
      const body = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const res = await fetch(`${base}/storage/v1/object/${GALLERY_BUCKET}/${path}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': contentType, 'x-upsert': 'false' },
        body,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(`Image upload failed: ${body?.message ?? res.status}`);
      }
    },

    async deleteObject(path: string): Promise<void> {
      await fetch(`${base}/storage/v1/object/${GALLERY_BUCKET}/${path}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      // Best-effort: a dangling object is preferable to a failed delete flow.
    },

    publicUrl(path: string): string {
      return `${base}/storage/v1/object/public/${GALLERY_BUCKET}/${path}`;
    },
  };
}

export type StorageClient = ReturnType<typeof createStorageClient>;

/** Builds a client from env, or null when storage is not configured. */
export function storageFromEnv(): StorageClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createStorageClient({ supabaseUrl, serviceRoleKey });
}
