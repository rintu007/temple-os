'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { uploadGalleryImageAction } from '../gallery-actions';

export function UploadImageForm() {
  const [state, formAction, pending] = useActionState(uploadGalleryImageAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="file">Image (JPEG/PNG/WebP, up to 5 MB)</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            required
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="caption">Caption (optional)</Label>
          <Input id="caption" name="caption" placeholder="Sandhya aarti, 2026" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </form>
  );
}
