'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { createTransferAction } from '../actions';

export function TransferForm({
  accounts,
  currency,
}: {
  accounts: Array<{ id: string; name: string }>;
  currency: string;
}) {
  const [state, formAction, pending] = useActionState(createTransferAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {accounts.length < 2 ? (
        <Alert tone="info">
          You need at least two active accounts to record a transfer. Add another account first.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fromAccountId">From account</Label>
          <Select id="fromAccountId" name="fromAccountId" defaultValue="" required>
            <option value="" disabled>
              Choose source…
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="toAccountId">To account</Label>
          <Select id="toAccountId" name="toAccountId" defaultValue="" required>
            <option value="" disabled>
              Choose destination…
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ({currency})</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="transferredOn">Date</Label>
          <Input
            id="transferredOn"
            name="transferredOn"
            type="date"
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reference">Reference (optional)</Label>
          <Input id="reference" name="reference" placeholder="Cheque no, UTR…" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea id="note" name="note" rows={2} />
      </div>

      <Button type="submit" disabled={pending || accounts.length < 2}>
        {pending ? 'Recording…' : 'Record transfer'}
      </Button>
    </form>
  );
}
