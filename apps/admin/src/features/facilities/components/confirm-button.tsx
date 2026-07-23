'use client';

import { useActionState } from 'react';
import { Button } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface ConfirmButtonProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}

/** Confirm with inline error surfacing (double-booking conflicts show here). */
export function ConfirmButton({ action }: ConfirmButtonProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Button size="sm" type="submit" disabled={pending}>
        {pending ? 'Confirming…' : 'Confirm'}
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
