'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { recordPaymentAction } from '../actions';

const METHODS: Array<{ value: string; label: string }> = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
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
    recordPaymentAction.bind(null, recurringId),
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
            min="0"
            defaultValue={defaultAmount}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="method">Method</Label>
          <Select id="method" name="method" defaultValue="bank_transfer">
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="paidOn">Paid on</Label>
          <Input id="paidOn" name="paidOn" type="date" defaultValue={today} required />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record payment'}
      </Button>
    </form>
  );
}
