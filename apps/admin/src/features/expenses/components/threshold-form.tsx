'use client';

import { useActionState } from 'react';
import { Alert, Button, Input } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { setApprovalThresholdAction } from '../actions';

export function ThresholdForm({ threshold }: { threshold: string | null }) {
  const [state, formAction, pending] = useActionState(setApprovalThresholdAction, initialFormState);

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="threshold" className="text-sm font-medium">
            Approval threshold
          </label>
          <Input
            id="threshold"
            name="threshold"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            defaultValue={threshold ?? ''}
            placeholder="Leave blank to disable"
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Expenses at or above this amount need a manager&apos;s approval. Leave blank to record every
        expense without sign-off.
      </p>
    </form>
  );
}
