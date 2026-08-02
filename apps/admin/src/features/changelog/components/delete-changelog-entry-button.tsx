'use client';

import { useActionState } from 'react';
import { Button } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { deleteChangelogEntryAction } from '../actions';

export function DeleteChangelogEntryButton({ id }: { id: string }) {
  const [, formAction, pending] = useActionState(
    deleteChangelogEntryAction.bind(null, id),
    initialFormState,
  );

  return (
    <form action={formAction}>
      <Button variant="destructive" size="sm" type="submit" disabled={pending}>
        {pending ? 'Deleting…' : 'Delete'}
      </Button>
    </form>
  );
}
