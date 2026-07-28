'use client';

import { useActionState } from 'react';
import type { RecurringDonationSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

interface RecurringDonationFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  recurring?: RecurringDonationSummary;
  devotees: Array<{ id: string; fullName: string }>;
  funds: Array<{ id: string; name: string }>;
  currency: string;
  submitLabel: string;
}

export function RecurringDonationForm({
  action,
  recurring,
  devotees,
  funds,
  currency,
  submitLabel,
}: RecurringDonationFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="donorName">Donor name</Label>
          <Input
            id="donorName"
            name="donorName"
            defaultValue={recurring?.donorName}
            minLength={2}
            placeholder="Leave blank if linking a devotee below"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="devoteeId">Linked devotee (optional)</Label>
          <Select id="devoteeId" name="devoteeId" defaultValue={recurring?.devoteeId ?? ''}>
            <option value="">— Not linked —</option>
            {devotees.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount per cycle ({currency})</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="1"
            defaultValue={recurring?.amount}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="frequency">Frequency</Label>
          <Select id="frequency" name="frequency" defaultValue={recurring?.frequency ?? 'monthly'}>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        {funds.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="fundId">Earmark to fund (optional)</Label>
            <Select id="fundId" name="fundId" defaultValue={recurring?.fundId ?? ''}>
              <option value="">— General —</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={recurring?.startDate ?? today}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End date (optional)</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={recurring?.endDate ?? ''} />
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
