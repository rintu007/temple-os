'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { renewMembershipAction } from '../actions';

interface RenewFormProps {
  subscriptionId: string;
  currency: string;
  /** Plan price, prefilled as the default amount. */
  defaultAmount: string;
}

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export function RenewForm({ subscriptionId, currency, defaultAmount }: RenewFormProps) {
  const [state, formAction, pending] = useActionState(
    renewMembershipAction.bind(null, subscriptionId),
    initialFormState,
  );

  if (state.message) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-2">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Select name="method" defaultValue="cash" aria-label="Payment method" className="w-28">
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
        <Input
          name="amount"
          type="number"
          step="0.01"
          min="1"
          defaultValue={defaultAmount}
          aria-label={`Amount (${currency})`}
          className="w-28"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Renewing…' : 'Renew'}
        </Button>
      </div>
    </form>
  );
}
