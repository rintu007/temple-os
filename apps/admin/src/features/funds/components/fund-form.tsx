'use client';

import { useActionState } from 'react';
import type { FundSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface FundFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fund?: FundSummary;
  submitLabel: string;
}

export function FundForm({ action, fund, submitLabel }: FundFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="name">Fund name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={fund?.name}
          required
          minLength={2}
          placeholder="Corpus, Building, Annadanam…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={fund?.description ?? ''} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
