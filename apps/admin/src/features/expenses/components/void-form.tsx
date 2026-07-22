'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface VoidFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}

export function VoidExpenseForm({ action }: VoidFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  if (state.message) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Input id="reason" name="reason" placeholder="e.g. entered twice" required />
      </div>
      <Button variant="destructive" size="sm" type="submit" disabled={pending}>
        {pending ? 'Voiding…' : 'Void expense'}
      </Button>
    </form>
  );
}
