'use client';

import { useActionState } from 'react';
import type { PujaTypeSummary } from '@templeos/core';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface PujaTypeFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  pujaType?: PujaTypeSummary;
  currency: string;
  submitLabel: string;
}

export function PujaTypeForm({ action, pujaType, currency, submitLabel }: PujaTypeFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="name">Puja name</Label>
        <Input id="name" name="name" defaultValue={pujaType?.name} placeholder="Satyanarayan Puja" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="price">Price ({currency})</Label>
        <Input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="1"
          defaultValue={pujaType?.price}
          placeholder="1100.00"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={pujaType?.description ?? ''}
          placeholder="Shown to devotees when booking"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={pujaType?.isActive ?? true}
          className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
        />
        Available for booking on the website
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
