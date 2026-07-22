'use client';

import { useActionState } from 'react';
import type { MembershipPlanSummary } from '@templeos/core';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface PlanFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  plan?: MembershipPlanSummary;
  currency: string;
  submitLabel: string;
}

export function PlanForm({ action, plan, currency, submitLabel }: PlanFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="name">Plan name</Label>
        <Input id="name" name="name" defaultValue={plan?.name} placeholder="Annual Member" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">Price ({currency})</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="1"
            defaultValue={plan?.price}
            placeholder="2100.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="durationMonths">Duration (months)</Label>
          <Input
            id="durationMonths"
            name="durationMonths"
            type="number"
            min="1"
            max="1200"
            defaultValue={plan?.durationMonths ?? 12}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={plan?.description ?? ''}
          placeholder="Shown to devotees when joining"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={plan?.isActive ?? true}
          className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
        />
        Available on the website
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
