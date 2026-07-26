'use client';

import { useActionState } from 'react';
import type { SevaSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

interface SevaFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  seva?: SevaSummary;
  devotees: Array<{ id: string; fullName: string }>;
  currency: string;
  submitLabel: string;
}

export function SevaForm({ action, seva, devotees, currency, submitLabel }: SevaFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sevaName">Seva</Label>
          <Input
            id="sevaName"
            name="sevaName"
            defaultValue={seva?.sevaName}
            required
            minLength={2}
            placeholder="Monthly Abhishekam"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount per occurrence ({currency})</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="1"
            defaultValue={seva?.amount}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sponsorName">Sponsor name</Label>
          <Input
            id="sponsorName"
            name="sponsorName"
            defaultValue={seva?.sponsorName}
            required
            minLength={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="devoteeId">Linked devotee (optional)</Label>
          <Select id="devoteeId" name="devoteeId" defaultValue={seva?.devoteeId ?? ''}>
            <option value="">— Not linked —</option>
            {devotees.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="frequency">Frequency</Label>
          <Select id="frequency" name="frequency" defaultValue={seva?.frequency ?? 'monthly'}>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="occasion">Occasion / nakshatra (optional)</Label>
          <Input
            id="occasion"
            name="occasion"
            defaultValue={seva?.occasion ?? ''}
            placeholder="Pournami, Rohini nakshatra…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={seva?.startDate ?? today}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End date (optional)</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={seva?.endDate ?? ''} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" name="note" rows={2} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
