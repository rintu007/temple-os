'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { recordRecurringDonationPaymentAction } from '../actions';

const METHODS: Array<{ value: string; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export function RecordPaymentForm({
  recurringId,
  currency,
  defaultAmount,
}: {
  recurringId: string;
  currency: string;
  defaultAmount: string;
}) {
  const [state, formAction, pending] = useActionState(
    recordRecurringDonationPaymentAction.bind(null, recurringId),
    initialFormState,
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ({currency})</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="1"
            defaultValue={defaultAmount}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="method">Method</Label>
          <Select id="method" name="method" defaultValue="cash">
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="donatedOn">Date</Label>
          <Input id="donatedOn" name="donatedOn" type="date" defaultValue={today} required />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record gift'}
      </Button>
    </form>
  );
}
