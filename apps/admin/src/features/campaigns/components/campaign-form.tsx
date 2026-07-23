'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Textarea } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { createCampaignAction } from '../actions';

export function CampaignForm({ currency }: { currency: string }) {
  const [state, formAction, pending] = useActionState(createCampaignAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required minLength={3} placeholder="Temple Renovation Fund" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="goalAmount">Goal amount ({currency})</Label>
        <Input
          id="goalAmount"
          name="goalAmount"
          type="number"
          step="0.01"
          min="1"
          required
          placeholder="2000000"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          placeholder="What the funds will go towards"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create campaign'}
      </Button>
    </form>
  );
}
