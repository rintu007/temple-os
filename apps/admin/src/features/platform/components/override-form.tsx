'use client';

import { useActionState } from 'react';
import { PLATFORM_SUBSCRIPTION_STATUSES, type PlanCatalogEntry } from '@templeos/validators';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { applyOverrideAction } from '../actions';

const STATUS_LABELS: Record<string, string> = {
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
};

export function OverrideForm({
  organizationId,
  plans,
}: {
  organizationId: string;
  plans: PlanCatalogEntry[];
}) {
  const action = applyOverrideAction.bind(null, organizationId);
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="plan">Set plan</Label>
        <Select id="plan" name="plan" defaultValue="">
          <option value="">No change</option>
          {plans.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Set subscription status</Label>
        <Select id="status" name="status" defaultValue="">
          <option value="">No change</option>
          {PLATFORM_SUBSCRIPTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="extendTrialDays">Extend trial by (days)</Label>
        <Input id="extendTrialDays" name="extendTrialDays" type="number" min={1} max={365} placeholder="e.g. 14" />
        <p className="text-xs text-muted-foreground">
          Extends from today, or from the current trial end if it hasn&apos;t passed yet.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Applying…' : 'Apply override'}
      </Button>
    </form>
  );
}
