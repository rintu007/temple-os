'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { recordRepaymentAction } from '../actions';

export function RepaymentForm({
  loanId,
  currency,
  outstanding,
}: {
  loanId: string;
  currency: string;
  outstanding: string;
}) {
  const [state, formAction, pending] = useActionState(
    recordRepaymentAction.bind(null, loanId),
    initialFormState,
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <p className="text-sm text-muted-foreground">
        Outstanding:{' '}
        <span className="font-medium tabular-nums text-foreground">
          {outstanding} {currency}
        </span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Repayment amount ({currency})</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paidOn">Paid on</Label>
          <Input id="paidOn" name="paidOn" type="date" defaultValue={today} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" maxLength={300} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record repayment'}
      </Button>
    </form>
  );
}
