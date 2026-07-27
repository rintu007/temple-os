'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { createFundTransferAction } from '../actions';

export function FundTransferForm({
  funds,
  currency,
}: {
  funds: Array<{ id: string; name: string }>;
  currency: string;
}) {
  const [state, formAction, pending] = useActionState(createFundTransferAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {funds.length < 2 ? (
        <Alert tone="info">
          You need at least two active funds to reallocate between them. Add another fund first.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fromFundId">From fund</Label>
          <Select id="fromFundId" name="fromFundId" defaultValue="" required>
            <option value="" disabled>
              Choose source…
            </option>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="toFundId">To fund</Label>
          <Select id="toFundId" name="toFundId" defaultValue="" required>
            <option value="" disabled>
              Choose destination…
            </option>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
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
          <Input id="reference" name="reference" placeholder="Board resolution no…" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea id="note" name="note" rows={2} />
      </div>

      <Button type="submit" disabled={pending || funds.length < 2}>
        {pending ? 'Recording…' : 'Reallocate'}
      </Button>
    </form>
  );
}
