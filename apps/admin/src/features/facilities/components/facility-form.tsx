'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Textarea } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { createFacilityAction } from '../actions';

export function FacilityForm({ currency }: { currency: string }) {
  const [state, formAction, pending] = useActionState(createFacilityAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required minLength={2} placeholder="Kalyana Mandapam" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="rentAmount">Rent ({currency})</Label>
          <Input id="rentAmount" name="rentAmount" type="number" step="0.01" min="1" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">Capacity (optional)</Label>
          <Input id="capacity" name="capacity" type="number" min="0" placeholder="500" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={3} maxLength={2000} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add facility'}
      </Button>
    </form>
  );
}
