'use client';

import { useActionState } from 'react';
import type { RecurringExpenseSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

const FREQUENCY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

interface RecurringFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  recurring?: RecurringExpenseSummary;
  currency: string;
  accounts: Array<{ id: string; name: string }>;
  submitLabel: string;
}

export function RecurringForm({
  action,
  recurring,
  currency,
  accounts,
  submitLabel,
}: RecurringFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="payee">Payee</Label>
          <Input
            id="payee"
            name="payee"
            defaultValue={recurring?.payee}
            required
            minLength={2}
            placeholder="Landlord, State Electricity Board…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            name="description"
            defaultValue={recurring?.description ?? ''}
            placeholder="Office rent, EB bill…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ({currency})</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={recurring?.amount}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="frequency">Frequency</Label>
          <Select id="frequency" name="frequency" defaultValue={recurring?.frequency ?? 'monthly'}>
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="startDate">First due / start date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={recurring?.startDate ?? ''}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End date (optional)</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={recurring?.endDate ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Expense category (optional)</Label>
          <Input
            id="category"
            name="category"
            defaultValue={recurring?.category ?? ''}
            placeholder="Rent, Utilities…"
          />
        </div>
        {accounts.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="accountId">Paid from account (optional)</Label>
            <Select id="accountId" name="accountId" defaultValue={recurring?.accountId ?? ''}>
              <option value="">— No default account —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
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
