'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Textarea } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { createAnnouncementAction } from '../announcement-actions';

export function AnnouncementForm() {
  const [state, formAction, pending] = useActionState(createAnnouncementAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="ann-title">Title</Label>
        <Input
          id="ann-title"
          name="title"
          required
          minLength={3}
          placeholder="e.g. Special darshan timings this Ekadashi"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ann-body">Details (optional)</Label>
        <Textarea id="ann-body" name="body" rows={3} maxLength={2000} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create draft'}
      </Button>
    </form>
  );
}
