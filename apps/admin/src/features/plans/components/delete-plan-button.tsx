'use client';

import { useActionState } from 'react';
import { Alert, Button } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { deletePlanAction } from '../actions';

export function DeletePlanButton({ planKey }: { planKey: string }) {
  const [state, formAction, pending] = useActionState(
    deletePlanAction.bind(null, planKey),
    initialFormState,
  );

  return (
    <div className="space-y-2">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <form action={formAction}>
        <Button variant="destructive" size="sm" type="submit" disabled={pending}>
          {pending ? 'Deleting…' : 'Delete plan'}
        </Button>
      </form>
    </div>
  );
}
