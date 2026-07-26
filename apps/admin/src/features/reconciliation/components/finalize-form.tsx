'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { recordReconciliationAction } from '../actions';

export function FinalizeForm({
  accountId,
  currency,
  clearedBalance,
}: {
  accountId: string;
  currency: string;
  clearedBalance: string;
}) {
  const [state, formAction, pending] = useActionState(
    recordReconciliationAction.bind(null, accountId),
    initialFormState,
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <p className="text-sm text-muted-foreground">
        Cleared balance in the books:{' '}
        <span className="font-medium tabular-nums text-foreground">
          {clearedBalance} {currency}
        </span>
        . Enter the closing balance from your bank statement to record the reconciliation.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="statementBalance">Statement closing balance ({currency})</Label>
          <Input
            id="statementBalance"
            name="statementBalance"
            type="number"
            step="0.01"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="statementDate">Statement date</Label>
          <Input id="statementDate" name="statementDate" type="date" defaultValue={today} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" maxLength={300} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record reconciliation'}
      </Button>
    </form>
  );
}
