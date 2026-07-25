'use client';

import { useActionState } from 'react';
import { BILL_PAYMENT_METHODS } from '@templeos/validators';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cheque: 'Cheque',
  other: 'Other',
};

interface PaymentFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  outstanding: string;
}

export function PaymentForm({ action, outstanding }: PaymentFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-3 border-t border-border pt-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            max={outstanding}
            defaultValue={outstanding}
            required
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="method">Method</Label>
          <Select id="method" name="method" defaultValue="bank_transfer">
            {BILL_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m] ?? m}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paidOn">Paid on</Label>
          <Input id="paidOn" name="paidOn" type="date" defaultValue={today} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reference">Reference</Label>
          <Input id="reference" name="reference" placeholder="UTR / cheque no." />
        </div>
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Recording…' : 'Record payment'}
      </Button>
    </form>
  );
}
