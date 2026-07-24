'use client';

import { useActionState } from 'react';
import { MEAL_LABELS, PRASADAM_MEALS } from '@templeos/validators';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { recordPrasadamAction } from '../actions';

interface PrasadamFormProps {
  currency: string;
}

export function PrasadamForm({ currency }: PrasadamFormProps) {
  const [state, formAction, pending] = useActionState(recordPrasadamAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="meal">Meal</Label>
          <Select id="meal" name="meal" defaultValue="lunch" required>
            {PRASADAM_MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABELS[m]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="servedOn">Date</Label>
          <Input id="servedOn" name="servedOn" type="date" defaultValue={today} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="servedCount">Number served</Label>
          <Input
            id="servedCount"
            name="servedCount"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="250"
            required
          />
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="text-sm font-medium">Sponsorship (optional)</div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          If a devotee sponsored this seva, record it — a receipt is issued and the amount joins
          your donation income.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sponsorName">Sponsor name</Label>
            <Input id="sponsorName" name="sponsorName" placeholder="Devotee or family" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sponsorAmount">Sponsor amount ({currency})</Label>
            <Input id="sponsorAmount" name="sponsorAmount" type="number" step="0.01" min="0" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note</Label>
        <Input id="note" name="note" placeholder="Menu, occasion, etc." />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record serving'}
      </Button>
    </form>
  );
}
