'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Textarea } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { createOpportunityAction } from '../actions';

export function OpportunityForm() {
  const [state, formAction, pending] = useActionState(createOpportunityAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required minLength={3} placeholder="Annakut kitchen help" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="servingOn">Date (optional)</Label>
          <Input id="servingOn" name="servingOn" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slotsNeeded">Volunteers needed (0 = no limit)</Label>
          <Input id="slotsNeeded" name="slotsNeeded" type="number" min="0" defaultValue="0" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={3} maxLength={2000} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create opportunity'}
      </Button>
    </form>
  );
}
