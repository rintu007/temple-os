'use client';

import { useActionState } from 'react';
import { Alert, Button, Input } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface RejectFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}

export function RejectForm({ action }: RejectFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <details className="mt-2">
      <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-destructive">
        Reject
      </summary>
      <form action={formAction} className="mt-2 flex gap-2">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        <Input name="reason" placeholder="Reason for rejection" required minLength={3} className="h-9" />
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          {pending ? '…' : 'Reject'}
        </Button>
      </form>
    </details>
  );
}
