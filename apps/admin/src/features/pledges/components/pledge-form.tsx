'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { createPledgeAction } from '../actions';

interface PledgeFormProps {
  campaigns: Array<{ id: string; title: string }>;
}

export function PledgeForm({ campaigns }: PledgeFormProps) {
  const [state, formAction, pending] = useActionState(createPledgeAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="donorName">Donor name</Label>
          <Input id="donorName" name="donorName" required minLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount pledged</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            inputMode="decimal"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="campaignId">Campaign (optional)</Label>
          <Select id="campaignId" name="campaignId" defaultValue="">
            <option value="">— None —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pledgedOn">Pledged on</Label>
          <Input id="pledgedOn" name="pledgedOn" type="date" required defaultValue={today} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueDate">Fulfil by (optional)</Label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="note">Note</Label>
          <Textarea id="note" name="note" rows={2} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Record pledge'}
      </Button>
    </form>
  );
}
