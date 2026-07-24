'use client';

import { useActionState } from 'react';
import { Alert, Button, Input } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { disposeAssetAction } from '../actions';

export function DisposeForm({ assetId }: { assetId: string }) {
  const [state, formAction, pending] = useActionState(
    disposeAssetAction.bind(null, assetId),
    initialFormState,
  );

  if (state.message) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <p className="text-sm text-muted-foreground">
        Marking an asset disposed keeps it in the register with a reason — it is never deleted.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="reason"
          placeholder="Reason (sold, damaged, transferred…)"
          required
          minLength={3}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? 'Disposing…' : 'Mark disposed'}
        </Button>
      </div>
    </form>
  );
}
