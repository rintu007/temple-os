'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Textarea } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { createChangelogEntryAction } from '../actions';

export function ChangelogEntryForm() {
  const [state, formAction, pending] = useActionState(createChangelogEntryAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="cl-title">Title</Label>
        <Input
          id="cl-title"
          name="title"
          required
          minLength={1}
          maxLength={120}
          placeholder="e.g. New: bulk devotee import"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cl-body">What changed</Label>
        <Textarea
          id="cl-body"
          name="body"
          required
          rows={4}
          maxLength={2000}
          placeholder="A short, plain-language description every temple's staff will see."
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Publishing…' : 'Publish'}
      </Button>
    </form>
  );
}
