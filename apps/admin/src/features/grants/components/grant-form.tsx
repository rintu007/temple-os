'use client';

import { useActionState } from 'react';
import type { GrantSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface GrantFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  grant?: GrantSummary;
  currency: string;
  submitLabel: string;
}

export function GrantForm({ action, grant, currency, submitLabel }: GrantFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="funder">Awarding body</Label>
          <Input
            id="funder"
            name="funder"
            defaultValue={grant?.funder}
            required
            minLength={2}
            placeholder="HR&CE Dept, XYZ Foundation (CSR)…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Grant / scheme title</Label>
          <Input
            id="title"
            name="title"
            defaultValue={grant?.title}
            required
            minLength={2}
            placeholder="Temple Renovation Scheme 2026"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sanctionedAmount">Sanctioned amount ({currency})</Label>
          <Input
            id="sanctionedAmount"
            name="sanctionedAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={grant?.sanctionedAmount}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sanctionedOn">Sanctioned on</Label>
          <Input
            id="sanctionedOn"
            name="sanctionedOn"
            type="date"
            defaultValue={grant?.sanctionedOn ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reference">Sanction order / reference no.</Label>
          <Input id="reference" name="reference" defaultValue={grant?.reference ?? ''} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="purpose">Purpose (printed on the utilization report)</Label>
        <Textarea id="purpose" name="purpose" rows={2} defaultValue={grant?.purpose ?? ''} />
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
