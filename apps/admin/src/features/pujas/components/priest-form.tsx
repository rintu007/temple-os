'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { addPriestAction } from '../actions';

export function PriestForm() {
  const [state, formAction, pending] = useActionState(addPriestAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="priest-name">Name</Label>
          <Input id="priest-name" name="name" required minLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priest-phone">Phone</Label>
          <Input id="priest-phone" name="phone" type="tel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priest-specialty">Specialty</Label>
          <Input id="priest-specialty" name="specialty" placeholder="e.g. Satyanarayan katha" />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add priest'}
      </Button>
    </form>
  );
}
